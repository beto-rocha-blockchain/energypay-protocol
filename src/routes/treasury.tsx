import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  ExternalLink,
  Radio,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperator } from "@/store/operator";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWalletActivity } from "@/hooks/useWalletActivity";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { StellarRailMonitor } from "@/components/generator/StellarRailMonitor";
import { stellarExpertTx, STELLAR_NETWORK_LABEL } from "@/lib/stellar";

export const Route = createFileRoute("/treasury")({
  head: () => ({
    meta: [
      { title: "Treasury & Settlement Rails — EnergyPay" },
      {
        name: "description",
        content:
          "Stellar settlement rail monitoring, treasury balances and ledger activity.",
      },
    ],
  }),
  component: TreasuryPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const shortHash = (h: string) =>
  h && h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h || "—";

const fmtNum = (n: number | string) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 7 });

function TreasuryPage() {
  const operator = useOperator((s) => s.operator);
  const pk = operator?.wallet?.publicKey ?? null;
  const balances = useWalletBalances(pk);
  const activity = useWalletActivity(pk);
  const { stats, horizon, loading, refresh } = useDashboard();
  const { health, telemetry } = useSettlementRail();

  const xlm = balances.data?.summary?.xlm ?? "0.0000000";
  const eprw = balances.data?.summary?.eprw ?? "0.0000000";
  const settled = stats?.settled_count ?? 0;
  const failed = stats?.failed_count ?? 0;
  const totalBrl = stats?.total_value_brl ?? 0;
  const horizonLatency = horizon?.latency_ms ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Treasury · Settlement Rail Operations
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Treasury & Settlement Rails
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
          label="Operator XLM"
          value={Number(xlm).toFixed(4)}
          sub={pk ? `${pk.slice(0, 6)}…${pk.slice(-4)}` : "no operator"}
          loading={balances.loading && !balances.data}
        />
        <KpiCard
          label="EPWR Inventory"
          value={fmtNum(eprw)}
          sub="EPWR"
          loading={balances.loading && !balances.data}
        />
        <KpiCard
          label="Settled Volume"
          value={fmtBRL(totalBrl)}
          sub={`${settled} confirmed`}
          loading={loading && !stats}
          tone="ok"
        />
        <KpiCard
          label="Failed"
          value={String(failed)}
          sub={failed > 0 ? "requires review" : "no failures"}
          loading={loading && !stats}
          tone={failed > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="Users"
          value={String(stats?.total_users ?? 0)}
          sub="counterparties"
          loading={loading && !stats}
        />
        <KpiCard
          label="Rail Status"
          value={health?.status === "ok" ? "CONNECTED" : "OFFLINE"}
          sub={`Horizon ${horizonLatency} ms`}
          loading={loading && !health}
          tone={health?.status === "ok" ? "ok" : "warn"}
          led
        />
      </div>

      {/* Blockchain Monitor + Telemetry */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <StellarRailMonitor />

          {/* Payment Routing Pipeline */}
          <Card className="border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Generator → Clearing → Counterparty · Programmable Leg
            </p>
            <p className="mt-0.5 font-display text-base font-semibold">Payment Routing</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-background/40 p-4">
              {[
                { l: "Generator", s: "EPWR issued" },
                { l: "Clearing", s: "Margin verified" },
                { l: "Settlement Rail", s: "Stellar broadcast" },
                { l: "Counterparty", s: "EPWR delivered" },
                { l: "BRL Leg", s: "Custody settled" },
              ].map((n, i, arr) => (
                <div key={n.l} className="flex items-center gap-2">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/40 bg-primary/10">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    </div>
                    <p className="mt-1 font-display text-[11px] font-medium">{n.l}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {n.s}
                    </p>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Treasury Telemetry */}
        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Treasury Telemetry
          </p>
          <div className="mt-3 space-y-2">
            <TelRow label="Operator XLM" value={`${Number(xlm).toFixed(4)} XLM`} tone="ok" />
            <TelRow label="EPWR Balance" value={`${fmtNum(eprw)} EPWR`} tone="ok" />
            <TelRow label="Horizon latency" value={`${horizonLatency} ms`} tone={horizonLatency < 1000 ? "ok" : "warn"} />
            <TelRow label="Backend latency" value={`${health?.backend?.latency_ms ?? 0} ms`} tone="ok" />
            <TelRow label="Settled count" value={String(settled)} tone="ok" />
            <TelRow label="Failed count" value={String(failed)} tone={failed > 0 ? "warn" : "ok"} />
            <TelRow label="Total BRL" value={fmtBRL(totalBrl)} tone="muted" />
            <TelRow label="Users" value={String(stats?.total_users ?? 0)} tone="muted" />
          </div>
        </Card>
      </div>

      {/* Live Ledger Activity */}
      <Card className="border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Stellar Horizon · Real-time Ledger Activity
            </p>
            <p className="mt-0.5 font-display text-base font-semibold">
              Recent Ledger Operations
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            {activity.fetchedAt && (
              <Badge variant="outline" className="border-success/40 text-success">
                <Activity className="mr-1.5 h-3 w-3 animate-pulse" />
                STREAMING
              </Badge>
            )}
            {activity.fetchedAt && (
              <span className="text-muted-foreground">
                sync {new Date(activity.fetchedAt).toUTCString().slice(17, 25)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          {activity.loading && activity.events.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : activity.events.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="font-mono text-sm text-muted-foreground">
                No ledger activity in current window.
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Tx Hash</th>
                  <th className="px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Kind</th>
                  <th className="px-2 py-2 text-right font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Amount</th>
                  <th className="px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Asset</th>
                  <th className="px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Result</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {activity.events.slice(0, 10).map((ev) => (
                  <tr key={ev.id} className="border-b border-border/50 hover:bg-primary/[0.03]">
                    <td className="px-2 py-2 font-mono text-[11px] text-primary">
                      {shortHash(ev.tx_hash)}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                      {ev.kind}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px]">
                      {ev.amount ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px]">{ev.asset ?? "—"}</td>
                    <td className="px-2 py-2">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[9px] ${
                          ev.successful
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {ev.successful ? "FINALIZED" : "FAILED"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <a
                        href={stellarExpertTx(ev.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary"
                      >
                        View on Stellar Expert <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

function TelRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] ${color}`}>{value}</span>
    </div>
  );
}
