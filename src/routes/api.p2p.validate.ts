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
import {
  decodeBearerClaims,
  isExpired,
  canExecuteSettlementServer,
  rolesFromClaims,
} from "@/lib/jwt-claims";

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
        // Decode JWT payload to derive authoritative claims. The upstream
        // settlement backend is the only authority that verifies the
        // signature; the proxy uses the decoded claims so it never has to
        // trust client-supplied identity or roles on the request body.
        const claims = decodeBearerClaims(auth);
        if (!claims || isExpired(claims)) {
          opsLog("auth", "bearer token rejected (malformed or expired)", undefined, "warn");
          return json(
            401,
            { code: "UNAUTHORIZED", field: "authorization", message: "Invalid or expired token." },
            cors,
          );
        }

        const subjectId = claims.sub || claims.user_id;
        if (!subjectId) {
          opsLog("auth", "bearer token missing subject claim", undefined, "warn");
          return json(
            401,
            { code: "UNAUTHORIZED", field: "authorization", message: "Token has no subject." },
            cors,
          );
        }

        const claimRoles = rolesFromClaims(claims);
        opsLog("auth", `authenticated · sub=${subjectId} · roles=[${claimRoles.join(",") || "none"}]`);

        // Server-side authorization: only roles that may execute settlements
        // can reach the adapter. The frontend `canExecuteSettlement` helper
        // is UX-only and is not trusted here.
        if (!canExecuteSettlementServer(claims)) {
          opsLog("auth", `forbidden · roles=[${claimRoles.join(",") || "none"}]`, undefined, "warn");
          return json(
            403,
            {
              code: "FORBIDDEN",
              field: "authorization",
              message: "Operator role is not authorized to execute settlements.",
            },
            cors,
          );
        }

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

        // Override sender_user_id with the JWT subject so the client cannot
        // impersonate another operator. Strip any client-supplied roles.
        const safeBody: Record<string, unknown> =
          body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
        safeBody.sender_user_id = subjectId;
        delete safeBody.roles;
        delete safeBody.access_level;

        const result = await executeSettlement(safeBody, {
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
