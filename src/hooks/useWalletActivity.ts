import { useEffect, useRef, useState, useCallback } from "react";
import type { ActivityEvent } from "@/routes/api.wallet.$publicKey.activity";

export type { ActivityEvent };

type Response = {
  success: true;
  wallet: string;
  events: ActivityEvent[];
  latency_ms: number;
  checked_at: string;
  note?: string;
};

type ErrorResponse = {
  success: false;
  error: string;
  message?: string;
};

export type WalletActivityState = {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
  latency: number | null;
  refresh: () => void;
  refreshCount: number;
};

const POLL_INTERVAL_MS = 15_000;

export function useWalletActivity(publicKey: string | null | undefined): WalletActivityState {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(!!publicKey);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!publicKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/wallet/${publicKey}/activity?limit=20`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => null)) as Response | ErrorResponse | null;
      if (!res.ok || !body || body.success === false) {
        const msg =
          (body && body.success === false && (body.message || body.error)) ||
          `Activity fetch failed (HTTP ${res.status})`;
        setError(msg);
      } else {
        setEvents(body.events);
        setLatency(body.latency_ms);
        setFetchedAt(new Date().toISOString());
        setError(null);
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
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEvents();
    const id = window.setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [publicKey, fetchEvents]);

  return { events, loading, error, fetchedAt, latency, refresh: fetchEvents, refreshCount };
}
