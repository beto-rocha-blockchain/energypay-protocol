/**
 * Operational rail banner. Surfaces backend connectivity, Horizon
 * connectivity, and live telemetry counters in the institutional terminal
 * aesthetic. Renders at the top of the settlement screens.
 */

import { Activity, Radio, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSettlementRail, type RailState } from "@/hooks/useSettlementRail";

const STATE_COPY: Record<RailState, { label: string; tone: "ok" | "warn" | "err" | "muted" }> = {
  CONNECTED: { label: "Settlement Rail Connected", tone: "ok" },
  DEGRADED:  { label: "Settlement Rail Degraded",  tone: "warn" },
  OFFLINE:   { label: "Settlement Rail Offline",   tone: "err" },
  UNKNOWN:   { label: "Settlement Rail · probing", tone: "muted" },
};

const toneClass = (tone: "ok" | "warn" | "err" | "muted") =>
  tone === "ok"
    ? "border-success/40 bg-success/10 text-success"
    : tone === "warn"
    ? "border-warning/40 bg-warning/10 text-warning"
    : tone === "err"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-border bg-card text-muted-foreground";

const fmtMs = (n: number | null | undefined) =>
  typeof n === "number" && n > 0 ? `${n}ms` : "—";

export function SettlementRailBanner({ compact = false }: { compact?: boolean }) {
  const { railState, health, telemetry } = useSettlementRail();
  const copy = STATE_COPY[railState];
  const Icon =
    railState === "CONNECTED" ? CheckCircle2
    : railState === "OFFLINE" ? AlertTriangle
    : railState === "DEGRADED" ? AlertTriangle
    : Radio;

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] ${toneClass(copy.tone)}`}>
      <span className="flex items-center gap-1.5 uppercase tracking-widest">
        <Icon className={`h-3.5 w-3.5 ${railState === "CONNECTED" ? "" : "animate-pulse"}`} />
        {copy.label}
      </span>

      <span className="hidden h-3 w-px bg-current/30 md:inline-block" />

      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="uppercase tracking-widest">Backend</span>
        <span className={health?.backend.status === "ok" ? "text-success" : health?.backend.status === "degraded" ? "text-warning" : "text-destructive"}>
          {fmtMs(health?.backend.latency_ms)}
        </span>
      </span>

      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="uppercase tracking-widest">Horizon</span>
        <span className={health?.horizon.status === "ok" ? "text-success" : health?.horizon.status === "degraded" ? "text-warning" : "text-destructive"}>
          {fmtMs(health?.horizon.latency_ms)}
        </span>
      </span>

      {!compact && (
        <>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span className="uppercase tracking-widest">Finalized</span>
            <span className="text-foreground">{telemetry?.counters.finalized_count ?? 0}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="uppercase tracking-widest">Failed</span>
            <span className={`${(telemetry?.counters.failed_count ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}>
              {telemetry?.counters.failed_count ?? 0}
            </span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="uppercase tracking-widest">Pending</span>
            <span className={`${(telemetry?.pending_confirmations ?? 0) > 0 ? "text-warning" : "text-foreground"}`}>
              {telemetry?.pending_confirmations ?? 0}
            </span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="uppercase tracking-widest">Avg finality</span>
            <span className="text-foreground">{fmtMs(telemetry?.counters.avg_finality_ms)}</span>
          </span>
        </>
      )}
    </div>
  );
}
