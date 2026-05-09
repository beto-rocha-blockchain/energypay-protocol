/**
 * Settlement telemetry endpoint.
 *
 * GET /api/settlements/telemetry
 *   → { counters, recent_receipts, recent_logs }
 *
 * Read-only operational view used by the institutional terminal to surface
 * latency, finalized / failed counters, and the recent operational log.
 */

import { createFileRoute } from "@tanstack/react-router";
import { snapshot } from "@/lib/settlement-telemetry";
import { settlementStore } from "@/lib/settlement-store";
import { opsTail } from "@/lib/settlement-ops-log";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/settlements/telemetry")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        const counters = snapshot();
        const recent_receipts = await settlementStore.list(20);
        const recent_logs = opsTail(50);
        return new Response(
          JSON.stringify({ counters, recent_receipts, recent_logs }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
