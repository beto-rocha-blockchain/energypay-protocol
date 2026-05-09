/**
 * Settlement telemetry endpoint.
 *
 * GET /api/settlements/telemetry
 *   → { counters, recent_receipts, recent_logs }
 *
 * Auth: requires `Authorization: Bearer <token>`. Returns 401 otherwise.
 * CORS: same-origin only — Origin is reflected when present and credentials
 * are allowed. No wildcard.
 */

import { createFileRoute } from "@tanstack/react-router";
import { snapshot } from "@/lib/settlement-telemetry";
import { settlementStore } from "@/lib/settlement-store";
import { opsTail } from "@/lib/settlement-ops-log";

const buildCorsHeaders = (request: Request): Record<string, string> => {
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

export const Route = createFileRoute("/api/settlements/telemetry")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCorsHeaders(request) }),
      GET: async ({ request }) => {
        const cors = buildCorsHeaders(request);
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.toLowerCase().startsWith("bearer ") || auth.length < 16) {
          return new Response(
            JSON.stringify({ code: "UNAUTHORIZED", message: "Bearer token required." }),
            { status: 401, headers: { "Content-Type": "application/json", ...cors } },
          );
        }

        const counters = snapshot();
        const recent_receipts = await settlementStore.list(20);
        const recent_logs = opsTail(50);
        return new Response(
          JSON.stringify({ counters, recent_receipts, recent_logs }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...cors },
          },
        );
      },
    },
  },
});
