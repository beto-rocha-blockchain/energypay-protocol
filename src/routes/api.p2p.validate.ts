/**
 * Server-side P2P transfer gateway.
 *
 * Frontend POSTs the settlement intent here. This route delegates the full
 * lifecycle to the settlement adapter, which:
 *   - validates the canonical Zod schema
 *   - de-duplicates by transfer_id (retry-safe)
 *   - signs server-side (in-memory, backend custody)
 *   - submits to Horizon
 *   - normalizes the Horizon response into the canonical SettlementReceipt
 *
 * On validation failure, returns 422 `{ code, field, message }` so the UI
 * can map the error to the offending input.
 */

import { createFileRoute } from "@tanstack/react-router";
import { executeSettlement } from "@/lib/settlement-adapter";
import { opsLog } from "@/lib/settlement-ops-log";

const buildCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export const Route = createFileRoute("/api/p2p/validate")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCorsHeaders(request) }),

      POST: async ({ request }) => {
        const cors = buildCorsHeaders(request);

        // Auth gate: require bearer token before any further processing.
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.toLowerCase().startsWith("bearer ") || auth.length < 16) {
          opsLog("auth", "missing or malformed bearer token", undefined, "warn");
          return json(
            401,
            {
              code: "UNAUTHORIZED",
              field: "authorization",
              message: "Bearer token required.",
            },
            cors,
          );
        }
        opsLog("auth", "bearer token attached");

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, {
            code: "INVALID_PAYLOAD",
            field: "payload",
            message: "Request body must be valid JSON.",
          }, cors);
        }

        const result = await executeSettlement(body as Record<string, unknown>, {
          authorization: auth,
        });

        if (!result.ok) {
          return json(result.http_status, {
            code: result.code,
            field: result.field,
            message: result.message,
          }, cors);
        }

        // Canonical receipt shape — frontend renders directly from this.
        const r = result.receipt;
        return json(200, {
          transfer_id: r.transfer_id,
          tx_hash: r.tx_hash,
          ledger: r.ledger,
          sender: r.sender,
          recipient: r.recipient,
          asset: r.asset,
          amount: r.amount,
          memo: r.memo,
          submitted_at: r.submitted_at,
          finalized_at: r.finalized_at,
          latency_ms: r.latency_ms,
          explorer_url: r.explorer_url,
          status: r.status,
          idempotent_replay: result.idempotent_replay,
          source_public_key: r.sender,
          destination_public_key: r.recipient,
          finality_ms: r.latency_ms,
          explorer_link: r.explorer_url,
          timestamp: r.finalized_at,
        }, cors);
      },
    },
  },
});
