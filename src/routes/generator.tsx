import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  Zap,
  Radio,
  ArrowRight,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperator, maskAddress } from "@/store/operator";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWalletActivity } from "@/hooks/useWalletActivity";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { stellarExpertAccount, stellarExpertTx, STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import { BrazilGridMap } from "@/components/generator/BrazilGridMap";
import { StellarRailMonitor } from "@/components/generator/StellarRailMonitor";

export const Route = createFileRoute("/generator")({
  head: () => ({
    meta: [
      { title: "Generator Operations Terminal — EnergyPay" },
      {
        name: "description",
        content:
          "SCADA-grade operations terminal for energy producers — generation telemetry, EPWR issuance, and Stellar settlement rail.",
      },
    ],
  }),
  component: GeneratorPage,
});

const fmtN = (n: number, max = 2) => n.toLocaleString("en-US", { maximumFractionDigits: max });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const shortHash = (h: string) =>
  h && h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h || "—";

function GeneratorPage() {
  const operator = useOperator((s) => s.operator);
  const isAuthenticated = useOperator((s) => s.isAuthenticated);

  const publicKey = operator?.wallet?.publicKey ?? null;
  const { data: balances, error: balErr } = useWalletBalances(publicKey);
  const {
    events,
    error: actErr,
    loading: actLoading,
    fetchedAt: actFetchedAt,
  } = useWalletActivity(publicKey);
  const { stats, horizon, loading, refresh } = useDashboard();
  const { health } = useSettlementRail();

  const eprwBalance = useMemo(() => {
    const v = Number(balances?.summary?.eprw ?? balances?.balances?.eprw ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [balances]);

  const xlmBalance = Number(balances?.summary?.xlm ?? balances?.balances?.xlm ?? 0);

  if (!isAuthenticated || !operator || !publicKey) {
    return <Navigate to="/login" />;
  }

  const settled = stats?.settled_count ?? 0;
  const failed = stats?.failed_count ?? 0;
  const totalBrl = stats?.total_value_brl ?? 0;
  const horizonLatency = horizon?.latency_ms ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Generator Operations · SCADA + Settlement Command Center
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Generator Operations Terminal
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase tracking-widest ${
              health?.status === "ok"
                ? "border-success/40 text-success"
                : "border-destructive/40 text-destructive"
            }`}
          >
            {health?.status === "ok" ? (
              <CheckCircle2 className="mr-1.5 h-3 w-3" />
            ) : (
              <AlertTriangle className="mr-1.5 h-3 w-3" />
            )}
            Rail · {health?.status === "ok" ? "CONNECTED" : "OFFLINE"}
          </Badge>
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
          value={Number(xlmBalance).toFixed(4)}
          sub={publicKey ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}` : "no operator"}
          loading={balances === null && !balErr}
        />
        <KpiCard
          label="EPWR Inventory"
          value={fmtN(eprwBalance)}
          sub="EPWR on-chain"
          loading={balances === null && !balErr}
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
          label="Contracts"
          value={String(stats?.active_contracts ?? 0)}
          sub={`of ${stats?.total_contracts ?? 0} total`}
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

      {/* Regional Energy Map */}
      <BrazilGridMap />

      {/* Stellar Settlement Rails */}
      <StellarRailMonitor />

      {/* On-Chain Treasury + Ledger Activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Treasury */}
        <Card className="border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Settlement Wallet · Stellar Custody
              </p>
              <p className="mt-0.5 font-display text-base font-semibold">On-Chain Treasury</p>
            </div>
            <Link
              to="/wallet"
              className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              Open wallet
              <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            <BalanceTile symbol="XLM" label="Network Reserve" value={balances ? fmtN(xlmBalance, 4) : null} error={balErr} />
            <BalanceTile symbol="EPWR" label="Tokenized Energy" value={balances ? fmtN(eprwBalance, 2) : null} error={balErr} />
          </div>

          <div className="mt-3 space-y-1.5">
            <TelRow label="Wallet" value={maskAddress(publicKey)} />
            <TelRow label="Network" value={health?.status === "ok" ? "CONNECTED" : "OFFLINE"} tone={health?.status === "ok" ? "ok" : "warn"} />
            <TelRow label="Horizon latency" value={`${horizonLatency} ms`} tone={horizonLatency < 1000 ? "ok" : "warn"} />
            <TelRow label="Subentries" value={balances ? String(balances.subentry_count) : "—"} />
          </div>

          <a
            href={stellarExpertAccount(publicKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
          >
            View on Stellar Expert
            <ExternalLink className="h-3 w-3" />
          </a>
        </Card>

        {/* Recent Ledger Activity */}
        <Card className="border-border bg-card p-4 xl:col-span-2">
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
              {actFetchedAt && (
                <Badge variant="outline" className="border-success/40 text-success">
                  <Activity className="mr-1.5 h-3 w-3 animate-pulse" />
                  STREAMING
                </Badge>
              )}
              {actFetchedAt && (
                <span className="text-muted-foreground">
                  sync {new Date(actFetchedAt).toUTCString().slice(17, 25)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            {actLoading && events.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
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
                  {events.slice(0, 10).map((ev) => (
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

function BalanceTile({
  symbol,
  label,
  value,
  error,
}: {
  symbol: string;
  label: string;
  value: string | null;
  error: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : value === null ? (
        <Skeleton className="mt-1 h-7 w-32" />
      ) : (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-xl font-semibold tracking-tight">{value}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {symbol}
          </span>
        </div>
      )}
    </div>
  );
}

function TelRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] ${color}`}>{value}</span>
    </div>
  );
}
