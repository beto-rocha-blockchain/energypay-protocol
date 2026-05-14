/**
 * Blockchain activity feed proxy.
 *
 *   GET /api/wallet/:publicKey/activity?limit=20
 *
 * Pulls the latest Stellar operations directly from Horizon (testnet) and
 * normalizes them into a compact `ActivityEvent` shape consumed by the
 * institutional activity feed UI.
 */

import { createFileRoute } from "@tanstack/react-router";
import { StrKey } from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";

const buildCors = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
};

const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

export type ActivityKind =
  | "FUNDING"
  | "ISSUANCE"
  | "TRUSTLINE"
  | "SETTLEMENT"
  | "OFFER"
  | "OTHER";

export type ActivitySeverity = "info" | "ok" | "warn" | "critical";

export type ActivityEvent = {
  id: string;
  tx_hash: string;
  ledger: number;
  created_at: string;
  kind: ActivityKind;
  severity: ActivitySeverity;
  title: string;
  detail: string;
  asset?: string | null;
  amount?: string | null;
  counterparty?: string | null;
  successful: boolean;
};

type HorizonOp = {
  id: string;
  paging_token: string;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  transaction_successful: boolean;
  // payment / create_account
  funder?: string;
  account?: string;
  starting_balance?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  amount?: string;
  // change_trust
  trustor?: string;
  trustee?: string;
  limit?: string;
  // offers
  buying_asset_code?: string;
  selling_asset_code?: string;
  price?: string;
};

const EPRW = "EPRW";

const classifyOp = (op: HorizonOp, account: string): ActivityEvent => {
  const successful = op.transaction_successful !== false;
  const baseSeverity: ActivitySeverity = successful ? "ok" : "critical";

  let kind: ActivityKind = "OTHER";
  let title = op.type.replace(/_/g, " ").toUpperCase();
  let detail = "";
  let asset: string | null = null;
  let amount: string | null = null;
  let counterparty: string | null = null;
  let severity: ActivitySeverity = baseSeverity;

  switch (op.type) {
    case "create_account": {
      kind = "FUNDING";
      title = "Account Funded";
      amount = op.starting_balance ?? null;
      asset = "XLM";
      counterparty = op.funder ?? null;
      detail = `Friendbot/funder seeded ${amount ?? "—"} XLM into the settlement account.`;
      severity = successful ? "ok" : "critical";
      break;
    }
    case "payment": {
      const code = op.asset_type === "native" ? "XLM" : op.asset_code ?? "—";
      const incoming = op.to === account;
      asset = code;
      amount = op.amount ?? null;
      counterparty = incoming ? op.from ?? null : op.to ?? null;

      // Issuance heuristic: from === asset_issuer OR native-less path with EPRW issuance.
      const isIssuance =
        code === EPRW &&
        op.asset_issuer &&
        op.from === op.asset_issuer &&
        op.to === account;

      if (isIssuance) {
        kind = "ISSUANCE";
        title = "EPRW Issued";
        detail = `${amount ?? "—"} EPRW minted from issuer to settlement custody.`;
        severity = successful ? "ok" : "critical";
      } else {
        kind = "SETTLEMENT";
        title = incoming ? `Settlement Received · ${code}` : `Settlement Sent · ${code}`;
        detail = incoming
          ? `${amount ?? "—"} ${code} received from ${shorten(op.from)}.`
          : `${amount ?? "—"} ${code} dispatched to ${shorten(op.to)}.`;
        severity = successful ? (incoming ? "ok" : "info") : "critical";
      }
      break;
    }
    case "path_payment_strict_receive":
    case "path_payment_strict_send": {
      kind = "SETTLEMENT";
      title = "Path Payment";
      asset = op.asset_code ?? "XLM";
      amount = op.amount ?? null;
      counterparty = op.to === account ? op.from ?? null : op.to ?? null;
      detail = `Cross-asset settlement routed through Stellar DEX.`;
      severity = successful ? "ok" : "critical";
      break;
    }
    case "change_trust": {
      kind = "TRUSTLINE";
      const code = op.asset_code ?? "—";
      asset = code;
      const removing = op.limit === "0" || op.limit === "0.0000000";
      title = removing ? `Trustline Removed · ${code}` : `Trustline Established · ${code}`;
      detail = removing
        ? `Operator revoked ${code} trustline.`
        : `Operator authorized ${code} issued by ${shorten(op.asset_issuer)}.`;
      severity = successful ? (removing ? "warn" : "ok") : "critical";
      break;
    }
    case "manage_sell_offer":
    case "manage_buy_offer":
    case "create_passive_sell_offer": {
      kind = "OFFER";
      const sell = op.selling_asset_code ?? "XLM";
      const buy = op.buying_asset_code ?? "XLM";
      asset = `${sell}/${buy}`;
      amount = op.amount ?? null;
      title = `DEX Offer · ${sell}/${buy}`;
      detail = `Order book activity at price ${op.price ?? "—"}.`;
      severity = successful ? "info" : "warn";
      break;
    }
    case "set_options":
      kind = "OTHER";
      title = "Account Options Updated";
      detail = "Signer / threshold / flags update applied.";
      severity = successful ? "info" : "warn";
      break;
    default:
      kind = "OTHER";
      title = op.type.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      detail = `Stellar operation of type ${op.type}.`;
      severity = successful ? "info" : "warn";
  }

  return {
    id: op.id,
    tx_hash: op.transaction_hash,
    ledger: 0, // Horizon doesn't return ledger on operations endpoint directly; left as 0 (UI hides).
    created_at: op.created_at,
    kind,
    severity,
    title,
    detail,
    asset,
    amount,
    counterparty,
    successful,
  };
};

const shorten = (addr?: string | null) =>
  addr && addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr ?? "—";

export const Route = createFileRoute("/api/wallet/$publicKey/activity")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),

      GET: async ({ request, params }) => {
        const cors = buildCors(request);
        const publicKey = (params.publicKey ?? "").trim();

        if (!StrKey.isValidEd25519PublicKey(publicKey)) {
          return json(
            422,
            { success: false, error: "INVALID_PUBLIC_KEY" },
            cors,
          );
        }

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);

        const t0 = Date.now();
        try {
          const res = await fetch(
            `${HORIZON_URL}/accounts/${publicKey}/operations?order=desc&limit=${limit}&include_failed=true`,
            {
              method: "GET",
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(8_000),
            },
          );
          const latency = Date.now() - t0;

          if (res.status === 404) {
            return json(
              200,
              {
                success: true,
                wallet: publicKey,
                events: [],
                latency_ms: latency,
                checked_at: new Date().toISOString(),
                note: "Account not yet on ledger.",
              },
              cors,
            );
          }

          if (!res.ok) {
            return json(
              502,
              {
                success: false,
                error: `Horizon HTTP ${res.status}`,
                latency_ms: latency,
              },
              cors,
            );
          }

          const body = (await res.json()) as {
            _embedded?: { records?: HorizonOp[] };
          };

          const records = body._embedded?.records ?? [];
          const events = records.map((op) => classifyOp(op, publicKey));

          return json(
            200,
            {
              success: true,
              wallet: publicKey,
              events,
              latency_ms: latency,
              checked_at: new Date().toISOString(),
            },
            cors,
          );
        } catch (err) {
          return json(
            504,
            {
              success: false,
              error: "HORIZON_UNREACHABLE",
              message: (err as Error).message,
              latency_ms: Date.now() - t0,
            },
            cors,
          );
        }
      },
    },
  },
});
