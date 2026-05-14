import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Layers, Gauge, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSettlementRail } from "@/hooks/useSettlementRail";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function StellarRailMonitor() {
  const { health, telemetry, railState, isOffline } = useSettlementRail();

  const horizonMs = health?.horizon.latency_ms ?? 0;
  const backendMs = health?.backend.latency_ms ?? 0;
  const finalized = telemetry?.counters.finalized_count ?? 0;
  const failed = telemetry?.counters.failed_count ?? 0;
  const avgFinality = telemetry?.counters.avg_finality_ms ?? 0;
  const pending = telemetry?.pending_confirmations ?? 0;

  const uptimePct =
    finalized + failed > 0 ? Math.round((finalized / (finalized + failed)) * 100) : 99;

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Settlement Rails · Stellar Mainnet Test Anchor
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold">Blockchain Operational Monitor</h2>
        </div>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] uppercase tracking-widest ${
            railState === "CONNECTED"
              ? "border-success/40 text-success"
              : railState === "DEGRADED"
              ? "border-amber-500/40 text-amber-500"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {isOffline ? <AlertTriangle className="mr-1.5 h-3 w-3" /> : <CheckCircle2 className="mr-1.5 h-3 w-3 animate-pulse" />}
          Rail · {railState}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <RailStat
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Horizon Latency"
          value={`${fmt(horizonMs)} ms`}
          tone={horizonMs < 600 ? "ok" : horizonMs < 1500 ? "warn" : "bad"}
        />
        <RailStat
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Avg Finality"
          value={avgFinality > 0 ? `${fmt(avgFinality)} ms` : "—"}
          tone={avgFinality < 6000 ? "ok" : "warn"}
        />
        <RailStat
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Finalized · session"
          value={`${fmt(finalized)}`}
          tone="ok"
        />
        <RailStat
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Pending Confirmations"
          value={`${pending}`}
          tone={pending === 0 ? "ok" : pending < 3 ? "warn" : "bad"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <RailBar label="Rail Uptime" value={uptimePct} tone={uptimePct > 95 ? "ok" : "warn"} suffix="%" />
        <RailBar
          label="Backend Probe"
          value={Math.max(0, 100 - Math.min(100, backendMs / 20))}
          display={`${fmt(backendMs)} ms`}
          tone={backendMs < 400 ? "ok" : "warn"}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <NodeChip label="horizon-testnet" status={health?.horizon.status ?? "ok"} />
        <NodeChip label="settlement-adapter" status={health?.backend.status ?? "ok"} />
        <NodeChip label="ledger-stream" status={isOffline ? "offline" : "ok"} />
        <NodeChip label="trustline-monitor" status="ok" />
      </div>
    </Card>
  );
}

function RailStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad";
}) {
  const cls = tone === "ok" ? "text-success" : tone === "warn" ? "text-amber-500" : "text-destructive";
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className={cls}>{icon}</span>
        {label}
      </p>
      <p className={`mt-1 font-display text-lg font-semibold ${cls}`}>{value}</p>
    </div>
  );
}

function RailBar({
  label,
  value,
  tone,
  suffix,
  display,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad";
  suffix?: string;
  display?: string;
}) {
  const bar = tone === "ok" ? "bg-success" : tone === "warn" ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="font-mono text-[11px]">{display ?? `${Math.round(value)}${suffix ?? ""}`}</p>
      </div>
      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all duration-700 ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
        <div className="pointer-events-none absolute inset-0 animate-scada-scan bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
}

function NodeChip({ label, status }: { label: string; status: string }) {
  const ok = status === "ok";
  const warn = status === "degraded";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${
          ok ? "bg-success" : warn ? "bg-amber-500" : "bg-destructive"
        }`}
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}
