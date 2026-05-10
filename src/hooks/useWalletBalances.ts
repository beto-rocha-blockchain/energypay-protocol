import { useEffect, useRef, useState, useCallback } from "react";
import type { WalletAssetEntry } from "@/routes/api.wallet.$publicKey.balances";

export type { WalletAssetEntry };

export type WalletBalancesSummary = {
  xlm: string;
  eprw: string;
  eprw_code?: string;
  eprw_issuer?: string | null;
  eprw_limit?: string | null;
  eprw_trustline?: boolean;
};

export type WalletBalances = {
  success: true;
  wallet: string;
  network: string;
  account_funded: boolean;
  subentry_count: number;
  assets: WalletAssetEntry[];
  summary: WalletBalancesSummary;
  balances: { xlm: string; eprw: string };
  latency_ms: number;
  checked_at: string;
  note?: string;
};

export type WalletBalancesError = {
  success: false;
  error: string;
  message?: string;
};

export type WalletBalancesState = {
  data: WalletBalances | null;
  error: string | null;
  loading: boolean;
  fetchedAt: string | null;
  refreshCount: number;
  refresh: () => void;
};

const POLL_INTERVAL_MS = 10_000;

export function useWalletBalances(publicKey: string | null | undefined): WalletBalancesState {
  const [data, setData] = useState<WalletBalances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!publicKey);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/wallet/${publicKey}/balances`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => null)) as WalletBalances | WalletBalancesError | null;
      if (!res.ok || !body || body.success === false) {
        const msg =
          (body && body.success === false && (body.message || body.error)) ||
          `Balance fetch failed (HTTP ${res.status})`;
        setError(msg);
      } else {
        setData(body);
        setError(null);
        setFetchedAt(new Date().toISOString());
        setRefreshCount((n) => n + 1);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchBalances();
    const id = window.setInterval(fetchBalances, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [publicKey, fetchBalances]);

  return {
    data,
    error,
    loading,
    fetchedAt,
    refreshCount,
    refresh: fetchBalances,
  };
}
