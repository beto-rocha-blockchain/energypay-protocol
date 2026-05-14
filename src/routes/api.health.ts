/**
 * Settlement rail health probe.
 *
 *   GET /api/health
 *     → { status, backend, horizon, latency_ms, checked_at }
 *
 * Acts as the live heartbeat for the institutional terminal:
 *   - probes the configured settlement backend (`P2P_BACKEND_URL`)
 *   - probes Horizon connectivity (cached for 30s, per requirement)
 *   - reports CONNECTED / DEGRADED / OFFLINE
 *
 * The Worker that hosts this route caches the Horizon probe at module
 * scope so we never hit Horizon more than once per 30s window even under
 * heavy frontend polling.
 */

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const HORIZON_TTL_MS = 30_000;

type ProbeStatus = "ok" | "degraded" | "offline";

type HorizonCache = {
  status: ProbeStatus;
  latency_ms: number;
  checked_at: string;
  error?: string;
};

let horizonCache: HorizonCache | null = null;
let horizonExpiry = 0;

async function probeHorizon(): Promise<HorizonCache> {
  const now = Date.now();
  if (horizonCache && now < horizonExpiry) return horizonCache;
  const t0 = Date.now();
  try {
    const res = await fetch(`${HORIZON_URL}/`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    const latency = Date.now() - t0;
    horizonCache = {
      status: res.ok ? "ok" : "degraded",
      latency_ms: latency,
      checked_at: new Date().toISOString(),
      ...(res.ok ? {} : { error: `Horizon HTTP ${res.status}` }),
    };
  } catch (err) {
    horizonCache = {
      status: "offline",
      latency_ms: Date.now() - t0,
      checked_at: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
  horizonExpiry = now + HORIZON_TTL_MS;
  return horizonCache;
}

async function probeBackend(): Promise<HorizonCache> {
  const backend = (process.env.P2P_BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const t0 = Date.now();
  try {
    const res = await fetch(`${backend}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - t0,
      checked_at: new Date().toISOString(),
      ...(res.ok ? {} : { error: `Backend HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      status: "offline",
      latency_ms: Date.now() - t0,
      checked_at: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        const [backend, horizon] = await Promise.all([probeBackend(), probeHorizon()]);
        const overall: ProbeStatus =
          backend.status === "offline"
            ? "offline"
            : backend.status === "ok" && horizon.status === "ok"
            ? "ok"
            : "degraded";
        return json(200, {
          status: overall,
          backend,
          horizon,
          checked_at: new Date().toISOString(),
        });
      },
    },
  },
});
