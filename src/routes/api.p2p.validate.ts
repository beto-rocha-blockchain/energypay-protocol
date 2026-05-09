/**
 * Server-side P2P transfer validation gateway.
 *
 * The frontend POSTs the settlement intent here BEFORE the Stellar Testnet
 * backend sees it. This route enforces:
 *   - destination Stellar public key (G… ed25519 + StrKey checksum)
 *   - asset whitelist (EPWR | XLM)
 *   - amount bounds and finiteness
 *   - memo shape (Stellar memo_text · 28 bytes)
 *   - transferId shape (P2P-XXXXXX)
 *
 * On validation failure it returns 422 with a structured `{ code, field,
 * message }` payload so the settlement terminal can map errors directly to
 * the offending input. On success it forwards the payload to the configured
 * settlement backend (`P2P_BACKEND_URL`, default http://localhost:3000) and
 * proxies the Horizon response back to the client unchanged.
 */

import { createFileRoute } from "@tanstack/react-router";
import { validateP2PTransfer } from "@/lib/p2p-validation";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

export const Route = createFileRoute("/api/p2p/validate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, {
            code: "INVALID_PAYLOAD",
            field: "payload",
            message: "Request body must be valid JSON.",
          });
        }

        const result = validateP2PTransfer(body);
        if (!result.ok) {
          return json(422, {
            code: result.code,
            field: result.field,
            message: result.message,
          });
        }

        const backend = (process.env.P2P_BACKEND_URL ?? "http://localhost:3000")
          .replace(/\/+$/, "");
        const auth = request.headers.get("authorization") ?? undefined;

        try {
          const upstream = await fetch(`${backend}/api/p2p/transfer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(auth ? { Authorization: auth } : {}),
            },
            body: JSON.stringify(result.data),
          });
          const text = await upstream.text();
          const ctype = upstream.headers.get("content-type") ?? "application/json";
          return new Response(text, {
            status: upstream.status,
            headers: { "Content-Type": ctype, ...CORS_HEADERS },
          });
        } catch (err) {
          return json(502, {
            code: "BACKEND_UNREACHABLE",
            field: "payload",
            message: `Settlement backend unreachable: ${(err as Error).message}`,
          });
        }
      },
    },
  },
});
