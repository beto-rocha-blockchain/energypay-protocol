/**
 * Backend settlement adapter.
 *
 * This is the only module that talks to the Stellar settlement backend on
 * behalf of the EnergyPay frontend. The adapter:
 *
 *   1. validates the inbound payload against the canonical Zod schema
 *   2. de-duplicates by transfer_id (retry-safe — refresh / repeated clicks
 *      cannot produce two on-chain submissions for the same transfer_id)
 *   3. submits to the configured settlement backend, which:
 *        - builds the Stellar transaction
 *        - signs server-side, in-memory only
 *        - submits to Horizon
 *   4. normalizes the Horizon response into the canonical SettlementReceipt
 *   5. persists the receipt and updates telemetry
 *
 * Every step writes to the operational log so the institutional terminal
 * has a full audit trail. No mocked hashes, no fake ledgers — every field
 * on the receipt is sourced from the upstream Horizon submission.
 */

import {
  validateP2PTransfer,
  type P2PTransferInput,
  type ValidationFailure,
} from "@/lib/p2p-validation";
import {
  settlementStore,
  type SettlementReceipt,
} from "@/lib/settlement-store";
import {
  isTerminal,
  type SettlementState,
} from "@/lib/settlement-state-machine";
import {
  recordFailed,
  recordFinalized,
} from "@/lib/settlement-telemetry";
import { opsLog } from "@/lib/settlement-ops-log";

const STELLAR_EXPERT_TX = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

/* ------------------------------------------------------------------ */
/*  Adapter result shape                                              */
/* ------------------------------------------------------------------ */

export type AdapterFailure = {
  ok: false;
  http_status: number;
  code: string;
  field: string;
  message: string;
};

export type AdapterSuccess = {
  ok: true;
  http_status: number;
  receipt: SettlementReceipt;
  /** True when an existing receipt was returned without re-submitting. */
  idempotent_replay: boolean;
};

export type AdapterResult = AdapterSuccess | AdapterFailure;

/* ------------------------------------------------------------------ */
/*  Backend response shape (from http://localhost:3000/api/p2p/transfer) */
/* ------------------------------------------------------------------ */

type BackendTransferResponse = {
  transfer_id?: string;
  source_public_key?: string;
  destination_public_key?: string;
  asset?: "EPWR" | "XLM";
  amount?: number;
  tx_hash?: string;
  ledger?: number;
  finality_ms?: number;
  status?: SettlementState | "SETTLED" | "PENDING";
  explorer_link?: string;
  timestamp?: string;
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  In-flight de-duplication                                          */
/* ------------------------------------------------------------------ */

const inFlight = new Map<string, Promise<AdapterResult>>();

/* ------------------------------------------------------------------ */
/*  Adapter entrypoint                                                */
/* ------------------------------------------------------------------ */

export async function executeSettlement(
  input: unknown,
  options: { authorization?: string } = {},
): Promise<AdapterResult> {
  // Reference imported type for documentation/typing surface.
  void (null as unknown as P2PTransferInput);
  const t0 = Date.now();

  // ── 1. validation ───────────────────────────────────────────────────
  const raw = (input ?? {}) as Record<string, unknown>;
  opsLog("validation", "validating settlement payload", {
    sender: typeof raw.sender_user_id === "string" ? raw.sender_user_id : null,
    asset: typeof raw.asset === "string" ? raw.asset : null,
  });
  const v = validateP2PTransfer(input);
  if (!v.ok) {
    const f = v as ValidationFailure;
    opsLog("validation", `rejected · ${f.code} · ${f.message}`, { field: f.field }, "warn");
    return {
      ok: false,
      http_status: 422,
      code: f.code,
      field: String(f.field),
      message: f.message,
    };
  }
  const data = v.data;
  const transferId = data.transfer_id ?? `P2P-${cryptoRandom6()}`;

  // ── 2. idempotency (retry-safe) ─────────────────────────────────────
  const existing = await settlementStore.get(transferId);
  if (existing && isTerminal(existing.status)) {
    opsLog("idempotency", `replay hit · ${transferId} · ${existing.status}`, {
      tx_hash: existing.tx_hash,
    });
    return { ok: true, http_status: 200, receipt: existing, idempotent_replay: true };
  }
  const pending = inFlight.get(transferId);
  if (pending) {
    opsLog("idempotency", `coalescing concurrent submission · ${transferId}`);
    return pending;
  }

  const promise = (async (): Promise<AdapterResult> => {
    try {
      // ── 3. signing (delegated to backend custody) ───────────────────
      opsLog("signing", `delegating ed25519 signing to backend · ${transferId}`, {
        sender: data.sender_user_id,
      });

      // ── 4. Horizon submission via configured backend ────────────────
      const backend = (process.env.P2P_BACKEND_URL ?? "http://localhost:3000")
        .replace(/\/+$/, "");
      const submittedAt = new Date();
      const horizonStart = Date.now();
      opsLog("horizon", `→ POST ${backend}/api/p2p/transfer · ${transferId}`);

      let upstream: Response;
      try {
        upstream = await fetch(`${backend}/api/p2p/transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.authorization ? { Authorization: options.authorization } : {}),
          },
          body: JSON.stringify({ ...data, transfer_id: transferId }),
        });
      } catch (err) {
        const msg = (err as Error).message;
        recordFailed(Date.now() - horizonStart);
        opsLog("horizon", `backend unreachable · ${msg}`, undefined, "warn");
        return {
          ok: false,
          http_status: 502,
          code: "BACKEND_UNREACHABLE",
          field: "payload",
          message: `Settlement backend unreachable: ${msg}`,
        };
      }

      const horizonMs = Date.now() - horizonStart;
      const body = (await upstream.json().catch(() => null)) as BackendTransferResponse | null;

      if (!upstream.ok || !body || body.status === "FAILED" || !body.tx_hash || !body.ledger) {
        const msg = body?.error || `Settlement backend returned ${upstream.status}`;
        recordFailed(horizonMs);
        opsLog("horizon", `✗ submission failed · ${msg}`, { transferId }, "warn");
        // Persist a FAILED receipt so audit log is complete.
        const failedReceipt: SettlementReceipt = {
          transfer_id: transferId,
          tx_hash: body?.tx_hash ?? "",
          ledger: body?.ledger ?? 0,
          sender: body?.source_public_key ?? "",
          recipient: data.recipient_public_key,
          asset: data.asset,
          amount: data.amount,
          memo: data.memo ?? "",
          submitted_at: submittedAt.toISOString(),
          finalized_at: new Date().toISOString(),
          latency_ms: Date.now() - t0,
          explorer_url: body?.tx_hash ? STELLAR_EXPERT_TX(body.tx_hash) : "",
          status: "FAILED",
          error: msg,
        };
        await settlementStore.put(failedReceipt);
        return {
          ok: false,
          http_status: upstream.status >= 400 ? upstream.status : 502,
          code: "HORIZON_REJECTED",
          field: "payload",
          message: msg,
        };
      }

      // ── 5. confirmation + canonical receipt ─────────────────────────
      opsLog("confirmation", `✓ ledger #${body.ledger} · ${body.tx_hash}`, {
        transferId,
        horizon_ms: horizonMs,
      });

      const finalizedAt = new Date();
      const latencyMs = body.finality_ms ?? finalizedAt.getTime() - submittedAt.getTime();
      const receipt: SettlementReceipt = {
        transfer_id: body.transfer_id ?? transferId,
        tx_hash: body.tx_hash,
        ledger: body.ledger,
        sender: body.source_public_key ?? "",
        recipient: body.destination_public_key ?? data.recipient_public_key,
        asset: body.asset ?? data.asset,
        amount: body.amount ?? data.amount,
        memo: data.memo ?? "",
        submitted_at: submittedAt.toISOString(),
        finalized_at: finalizedAt.toISOString(),
        latency_ms: latencyMs,
        explorer_url: body.explorer_link || STELLAR_EXPERT_TX(body.tx_hash),
        status: "FINALIZED",
      };
      await settlementStore.put(receipt);
      recordFinalized(latencyMs, horizonMs);
      opsLog("confirmation", `✓ FINALIZED · ${receipt.transfer_id} · ${latencyMs}ms`);
      return { ok: true, http_status: 200, receipt, idempotent_replay: false };
    } finally {
      inFlight.delete(transferId);
    }
  })();

  inFlight.set(transferId, promise);
  return promise;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function cryptoRandom6(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let n = 0;
  for (const b of bytes) n = (n << 8) | b;
  return Math.abs(n % 1_000_000).toString().padStart(6, "0");
}
