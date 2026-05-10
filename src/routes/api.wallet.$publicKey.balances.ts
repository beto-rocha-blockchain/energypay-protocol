/**
 * Wallet balances proxy.
 *
 *   GET /api/wallet/:publicKey/balances
 *
 * Forwards to the backend `GET /api/wallet/:publicKey/balances` endpoint
 * and surfaces XLM + EPRW balances along with backend latency telemetry.
 *
 * Frontend-safe: the backend is the only caller of Horizon. We never
 * touch secret keys here.
 */

import { createFileRoute } from "@tanstack/react-router";
import { StrKey } from "@stellar/stellar-sdk";

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

export const Route = createFileRoute("/api/wallet/$publicKey/balances")({
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
            { success: false, error: "INVALID_PUBLIC_KEY", message: "Invalid Stellar public key" },
            cors,
          );
        }

        const backend = (process.env.P2P_BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
        const t0 = Date.now();
        try {
          const res = await fetch(`${backend}/api/wallet/${publicKey}/balances`, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
          });
          const latency = Date.now() - t0;
          const body = await res.json().catch(() => null) as
            | { success?: boolean; wallet?: string; balances?: { xlm?: string; eprw?: string }; error?: string }
            | null;

          if (!res.ok || !body?.success) {
            return json(
              res.status === 404 ? 404 : 502,
              {
                success: false,
                error: body?.error ?? `Backend HTTP ${res.status}`,
                wallet: publicKey,
                latency_ms: latency,
              },
              cors,
            );
          }

          return json(
            200,
            {
              success: true,
              wallet: body.wallet ?? publicKey,
              network: "STELLAR_TESTNET",
              balances: {
                xlm: body.balances?.xlm ?? "0",
                eprw: body.balances?.eprw ?? "0",
              },
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
              error: "BACKEND_UNREACHABLE",
              message: (err as Error).message,
              wallet: publicKey,
              latency_ms: Date.now() - t0,
            },
            cors,
          );
        }
      },
    },
  },
});
