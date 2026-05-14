/**
 * Wallet balances proxy — enriched.
 *
 *   GET /api/wallet/:publicKey/balances
 *
 * Reads the live account from Horizon (testnet) and returns:
 *   - full per-asset balance entries (with issuer + trustline limit)
 *   - convenience summary { xlm, eprw } for backwards compatibility
 *   - account funded state, subentry count, latency telemetry
 *
 * The frontend never holds secret keys — Horizon's read endpoints are public.
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

export type WalletAssetEntry = {
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12" | string;
  asset_code: string;
  asset_issuer: string | null;
  balance: string;
  limit: string | null;
  buying_liabilities: string | null;
  selling_liabilities: string | null;
  is_authorized: boolean;
  trustline: boolean;
};

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
  is_authorized?: boolean;
};

const normalizeBalance = (b: HorizonBalance): WalletAssetEntry => {
  const isNative = b.asset_type === "native";
  return {
    asset_type: b.asset_type,
    asset_code: isNative ? "XLM" : b.asset_code ?? "—",
    asset_issuer: isNative ? null : b.asset_issuer ?? null,
    balance: b.balance,
    limit: isNative ? null : b.limit ?? null,
    buying_liabilities: b.buying_liabilities ?? null,
    selling_liabilities: b.selling_liabilities ?? null,
    is_authorized: b.is_authorized ?? true,
    trustline: !isNative,
  };
};

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

        const t0 = Date.now();
        try {
          const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
          });
          const latency = Date.now() - t0;

          if (res.status === 404) {
            return json(
              200,
              {
                success: true,
                wallet: publicKey,
                network: "STELLAR_TESTNET",
                account_funded: false,
                subentry_count: 0,
                assets: [],
                summary: { xlm: "0", eprw: "0" },
                balances: { xlm: "0", eprw: "0" },
                latency_ms: latency,
                checked_at: new Date().toISOString(),
                note: "Account not yet funded on the ledger.",
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
                wallet: publicKey,
                latency_ms: latency,
              },
              cors,
            );
          }

          const acc = (await res.json()) as {
            balances: HorizonBalance[];
            subentry_count?: number;
          };

          const assets = (acc.balances ?? []).map(normalizeBalance);
          const xlm = assets.find((a) => a.asset_type === "native")?.balance ?? "0";

          // Match either spelling ("EPRW" backend / "EPWR" frontend) for resilience.
          const eprw = assets.find(
            (a) => a.asset_code === "EPRW" || a.asset_code === "EPWR",
          );

          return json(
            200,
            {
              success: true,
              wallet: publicKey,
              network: "STELLAR_TESTNET",
              account_funded: true,
              subentry_count: acc.subentry_count ?? 0,
              assets,
              summary: {
                xlm,
                eprw: eprw?.balance ?? "0",
                eprw_code: eprw?.asset_code ?? "EPRW",
                eprw_issuer: eprw?.asset_issuer ?? null,
                eprw_limit: eprw?.limit ?? null,
                eprw_trustline: !!eprw,
              },
              // Backwards-compat shape consumed by older clients.
              balances: { xlm, eprw: eprw?.balance ?? "0" },
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
