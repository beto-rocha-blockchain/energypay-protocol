/**
 * Settlement rail connectivity hook. Polls /api/health every 10s and
 * /api/settlements/telemetry every 15s. Reports a derived rail state of
 * CONNECTED / DEGRADED / OFFLINE that the UI uses to gate the Execute
 * Settlement action and render the operational banner.
 */

import { useEffect, useState } from "react";
import { getSession } from "@/lib/session";

export type RailState = "CONNECTED" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export type ProbeReport = {
  status: "ok" | "degraded" | "offline";
  latency_ms: number;
  checked_at: string;
  error?: string;
};

export type HealthReport = {
  status: "ok" | "degraded" | "offline";
  backend: ProbeReport;
  horizon: ProbeReport;
  checked_at: string;
};

export type TelemetryCounters = {
  finalized_count: number;
  failed_count: number;
  avg_finality_ms: number;
  avg_horizon_ms: number;
  last_updated_at: string | null;
};

export type TelemetrySnapshot = {
  counters: TelemetryCounters;
  pending_confirmations: number;
};

const HEALTH_INTERVAL_MS = 10_000;
const TELEMETRY_INTERVAL_MS = 15_000;

const deriveRailState = (h: HealthReport | null): RailState => {
  if (!h) return "UNKNOWN";
  if (h.status === "ok") return "CONNECTED";
  if (h.status === "offline") return "OFFLINE";
  return "DEGRADED";
};

export function useSettlementRail() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`health HTTP ${res.status}`);
        const data = (await res.json()) as HealthReport;
        if (!cancelled) {
          setHealth(data);
          setHealthError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setHealthError((err as Error).message);
          setHealth({
            status: "offline",
            backend: { status: "offline", latency_ms: 0, checked_at: new Date().toISOString(), error: (err as Error).message },
            horizon: { status: "offline", latency_ms: 0, checked_at: new Date().toISOString() },
            checked_at: new Date().toISOString(),
          });
        }
      }
    };
    tick();
    const id = setInterval(tick, HEALTH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const token = getSession()?.token;
        if (!token) return;
        const res = await fetch("/api/settlements/telemetry", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const counters: TelemetryCounters = data.counters;
        const logs: Array<{ stage?: string; message?: string }> =
          Array.isArray(data.recent_logs) ? data.recent_logs : [];
        const receipts: Array<unknown> =
          Array.isArray(data.recent_receipts) ? data.recent_receipts : [];
        const submissions = logs.filter(
          (l) => l.stage === "horizon" && /→\s*POST/i.test(l.message ?? ""),
        ).length;
        const pending = Math.max(0, submissions - receipts.length);
        setTelemetry({ counters, pending_confirmations: pending });
      } catch {
        /* keep last good telemetry */
      }
    };
    tick();
    const id = setInterval(tick, TELEMETRY_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const railState = deriveRailState(health);

  return {
    railState,
    health,
    telemetry,
    healthError,
    isExecutable: railState === "CONNECTED" || railState === "DEGRADED",
    isOffline: railState === "OFFLINE",
  };
}
