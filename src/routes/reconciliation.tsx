import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { stellarExpertTx, STELLAR_NETWORK_LABEL } from "@/lib/stellar";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({
    meta: [
      { title: "Reconciliation — EnergyPay" },
      {
        name: "description",
        content:
          "Settlement reconciliation, ledger validation, finality metrics and transaction audit.",
      },
    ],
  }),
  component: ReconciliationPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const shortHash = (h: string) =>
  h && h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h || "—";

const timeAgo = (iso: string) => {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function ReconciliationPage() {
  const { stats, settlements, horizon, loading, refresh } = useDashboard();
  const { health, telemetry } = useSettlementRail();

  const total = stats?.total_settlements ?? 0;
  const settled = stats?.settled_count ?? 0;
  const failed = stats?.failed_count ?? 0;
  const pending = total - settled - failed;
  const successRate = total > 0 ? (settled / total) * 100 : 0;
  const finalityMs = stats?.avg_finality_ms ?? 0;
  const horizonLatency = horizon?.latency_ms ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Reconciliation · Ledger Validation
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Reconciliation Engine
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            <Radio className="mr-1.5 h-3 w-3 text-success" />
            {STELLAR_NETWORK_LABEL}
          </Badge>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total Processed"
          value={String(total)}
          sub="reconciliation entries"
          loading={loading && !stats}
        />
        <KpiCard
          label="Reconciled"
          value={String(settled)}
          sub="ledger-confirmed"
          loading={loading && !stats}
          tone="ok"
        />
        <KpiCard
          label="Failed"
          value={String(failed)}
          sub="mismatch / reverted"
          loading={loading && !stats}
          tone={failed > 0 ? "warn" : "ok"}
          led={failed > 0}
        />
        <KpiCard
          label="Pending"
          value={String(pending)}
          sub="awaiting confirmation"
          loading={loading && !stats}
          tone={pending > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="Success Rate"
          value={total > 0 ? fmtPct(successRate) : "—"}
          sub="reconciliation rate"
          loading={loading && !stats}
          tone={successRate >= 95 ? "ok" : "warn"}
          led={successRate >= 95}
        />
        <KpiCard
          label="Horizon"
          value={horizon?.horizon_online ? "ONLINE" : "OFFLINE"}
          sub={`${horizonLatency} ms latency`}
          loading={loading && !horizon}
          tone={horizon?.horizon_online ? "ok" : "warn"}
          led
        />
      </div>

      {/* Reconciliation Pipeline + Telemetry */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Reconciliation Pipeline · Health
          </p>
          <div className="mt-3 space-y-3">
            <HealthBar label="Ledger Reconciliation" value={successRate} />
            <HealthBar label="Horizon Connectivity" value={horizon?.horizon_online ? 100 : 0} />
            <HealthBar label="Backend Availability" value={health?.status === "ok" ? 100 : health?.status === "degraded" ? 50 : 0} />
            <HealthBar label="Finality SLA (< 6s)" value={finalityMs > 0 ? Math.min(100, (6000 / finalityMs) * 100) : 0} />
          </div>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Reconciliation Telemetry
          </p>
          <div className="mt-3 space-y-2">
            <TelRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Reconciled rate" value={total > 0 ? fmtPct(successRate) : "—"} tone={successRate >= 95 ? "ok" : "warn"} />
            <TelRow icon={<Gauge className="h-3.5 w-3.5" />} label="Avg finality" value={finalityMs ? `${(finalityMs / 1000).toFixed(2)}s` : "—"} tone={finalityMs && finalityMs < 6000 ? "ok" : "warn"} />
            <TelRow icon={<Activity className="h-3.5 w-3.5" />} label="Horizon latency" value={`${horizonLatency} ms`} tone={horizonLatency < 1000 ? "ok" : "warn"} />
            <TelRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Confirmed" value={String(settled)} tone="ok" />
            <TelRow icon={<XCircle className="h-3.5 w-3.5" />} label="Exceptions" value={String(failed)} tone={failed > 0 ? "warn" : "ok"} />
          </div>
        </Card>
      </div>

      {/* Ledger Audit Table */}
      <Card className="border-border bg-card p-5">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Ledger Audit · Reconciled Transactions
          </p>
          <p className="font-display text-lg font-semibold">Transaction Reconciliation</p>
        </div>

        {loading && settlements.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="py-10 text-center">
            <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-mono text-sm text-muted-foreground">No reconciliation entries yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider">ID</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Seller</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Amount</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Tx Hash</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id + s.created_at} className="border-border">
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs">
                    {s.seller ? shortHash(s.seller) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-success">
                    {s.amount_brl ? fmtBRL(s.amount_brl) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.tx_hash && s.tx_hash !== "UNAVAILABLE" ? (
                      <a
                        href={stellarExpertTx(s.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        {shortHash(s.tx_hash)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        s.status === "SETTLED" || s.status === "CONFIRMED"
                          ? "border-success/40 bg-success/10 text-success"
                          : s.status === "FAILED"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-warning/40 bg-warning/10 text-warning"
                      }`}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(s.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({
  label,
  value,
  sub,
  loading,
  tone = "ok",
  led = false,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  tone?: "ok" | "warn" | "muted";
  led?: boolean;
}) {
  const valueColor = led
    ? tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : ""
    : "";
  const ledColor = tone === "ok" ? "bg-success" : tone === "warn" ? "bg-destructive" : "bg-muted-foreground";
  const fontSize = value.length > 16 ? "text-sm" : value.length > 12 ? "text-base" : "text-xl";

  return (
    <Card className="border-border bg-card p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <p className={`mt-1 font-mono font-semibold tracking-tight ${fontSize} ${valueColor} flex items-center gap-2`}>
          {led && (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${ledColor}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ledColor}`} />
            </span>
          )}
          {value}
        </p>
      )}
      {sub && (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {sub}
        </p>
      )}
    </Card>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 95 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={`font-mono text-[11px] ${pct >= 95 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive"}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TelRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[11px] ${color}`}>{value ?? "—"}</span>
    </div>
  );
}
