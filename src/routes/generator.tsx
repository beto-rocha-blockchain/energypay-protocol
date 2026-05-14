import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  Zap,
  Sun,
  Wind,
  Gauge,
  Factory,
  Coins,
  TrendingUp,
  Radio,
  ArrowUpRight,
  Sparkles,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperator, maskAddress } from "@/store/operator";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWalletActivity } from "@/hooks/useWalletActivity";
import { useGeneratorTelemetry } from "@/hooks/useGeneratorTelemetry";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { stellarExpertAccount, stellarExpertTx } from "@/lib/stellar";
import { BilateralContractsPanel } from "@/components/generator/BilateralContractsPanel";
import { BrazilGridMap } from "@/components/generator/BrazilGridMap";
import { AIForecastPanel } from "@/components/generator/AIForecastPanel";
import { StellarRailMonitor } from "@/components/generator/StellarRailMonitor";
import { LiveSettlementFeed } from "@/components/generator/LiveSettlementFeed";

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

const fmtN = (n: number, max = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: max });

function GeneratorPage() {
  const operator = useOperator((s) => s.operator);
  const isAuthenticated = useOperator((s) => s.isAuthenticated);

  if (!isAuthenticated || !operator) {
    return <Navigate to="/login" />;
  }

  const publicKey = operator.wallet.publicKey;
  const { data: balances, error: balErr } = useWalletBalances(publicKey);
  const { events, error: actErr, loading: actLoading, fetchedAt: actFetchedAt } = useWalletActivity(publicKey);
  const { railState, isOffline } = useSettlementRail();

  const eprwBalance = useMemo(() => {
    const v = Number(balances?.summary.eprw ?? balances?.balances.eprw ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [balances]);

  const xlmBalance = Number(balances?.summary.xlm ?? balances?.balances.xlm ?? 0);
  const telemetry = useGeneratorTelemetry({ eprwBalance });

  const recentSettlements = events.filter((e) => e.kind === "SETTLEMENT" || e.kind === "ISSUANCE").slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Generator Operations · SCADA + Settlement Command Center
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Generator Operations Command Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Programmable settlement rail for energy producers — live generation telemetry, EPWR issuance, on-chain settlement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RailIndicator state={railState} />
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            <Radio className="mr-1.5 h-3 w-3 text-success" />
            Stellar Testnet
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            <Activity className="mr-1.5 h-3 w-3 animate-pulse text-success" />
            LIVE · 5s tick
          </Badge>
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Live Output"
          value={`${fmtN(telemetry.currentOutputKwh, 0)}`}
          unit="kWh"
          icon={<Zap className="h-4 w-4" />}
          tone="primary"
          sub={`${fmtN(telemetry.gridInjectionMw, 2)} MW grid injection`}
        />
        <KpiCard
          label="Total Generated"
          value={fmtN(telemetry.totalGeneratedMwh, 2)}
          unit="MWh / 24h"
          icon={<Factory className="h-4 w-4" />}
          tone="success"
          sub={`Capacity ${fmtN(telemetry.capacityKwh, 0)} kWh`}
        />
        <KpiCard
          label="Operational Efficiency"
          value={`${fmtN(telemetry.efficiencyPct, 1)}%`}
          unit=""
          icon={<Gauge className="h-4 w-4" />}
          tone={telemetry.efficiencyPct > 70 ? "success" : "warn"}
          sub={`${telemetry.solarPct}% solar · ${telemetry.windPct}% wind`}
        />
        <KpiCard
          label="Active Contracts"
          value={`${telemetry.activeContracts}`}
          unit="bilateral"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="primary"
          sub={`${fmtN(telemetry.eprwSettlementVolume, 0)} EPWR settled`}
        />
      </div>

      {/* Production chart + sources */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Production · 24h hourly trend
              </p>
              <h2 className="mt-0.5 font-display text-base font-semibold">Live Generation Curve</h2>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color="primary" label="SOLAR" />
              <LegendDot color="success" label="WIND" />
            </div>
          </div>

          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry.hourlySeries} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="solar" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="wind" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--success, 142 70% 45%))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 11,
                    fontFamily: "var(--font-mono, ui-monospace)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="solar"
                  stroke="hsl(var(--primary))"
                  fill="url(#solar)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="wind"
                  stroke="hsl(var(--success, 142 70% 45%))"
                  fill="url(#wind)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Source Mix · Live
          </p>

          <div className="mt-3 space-y-3">
            <SourceRow icon={<Sun className="h-4 w-4" />} label="Solar Array" pct={telemetry.solarPct} tone="primary" />
            <SourceRow icon={<Wind className="h-4 w-4" />} label="Wind Farm" pct={telemetry.windPct} tone="success" />
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Regional operational status
            </p>
            {telemetry.regions.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      r.status === "ONLINE"
                        ? "bg-success animate-pulse"
                        : r.status === "DEGRADED"
                        ? "bg-amber-500"
                        : "bg-destructive"
                    }`}
                  />
                  <span className="text-[11px]">{r.name}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {fmtN(r.outputKwh, 0)} kWh
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* EPWR + Inventory */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="EPWR Generated"
          value={fmtN(telemetry.eprwGenerated, 0)}
          unit="EPWR / 24h"
          icon={<Sparkles className="h-4 w-4" />}
          tone="primary"
          sub="Tokenized issuance"
        />
        <KpiCard
          label="EPWR Sold"
          value={fmtN(telemetry.eprwSold, 0)}
          unit="EPWR"
          icon={<ArrowUpRight className="h-4 w-4" />}
          tone="success"
          sub={`${Math.round((telemetry.eprwSold / Math.max(1, telemetry.eprwGenerated)) * 100)}% of issuance`}
        />
        <KpiCard
          label="Settlement Volume"
          value={fmtN(telemetry.eprwSettlementVolume, 0)}
          unit="EPWR cleared"
          icon={<Coins className="h-4 w-4" />}
          tone="primary"
          sub="Stellar settlement rail"
        />
        <KpiCard
          label="Inventory Available"
          value={fmtN(telemetry.inventoryMwh, 2)}
          unit="MWh"
          icon={<Factory className="h-4 w-4" />}
          tone="success"
          sub={`${fmtN(eprwBalance, 0)} EPWR on-chain`}
        />
      </div>

      {/* SECTION 4 — Regional Energy Generation Map */}
      <BrazilGridMap />

      {/* SECTION 3 — Active Bilateral Contracts */}
      <BilateralContractsPanel />

      {/* SECTION 6 — Stellar Settlement Rails */}
      <StellarRailMonitor />


      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Settlement Wallet · Stellar Custody
              </p>
              <h2 className="mt-0.5 font-display text-base font-semibold">On-Chain Treasury</h2>
            </div>
            <Link
              to="/wallet"
              className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              Open wallet
              <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <BalanceTile
              symbol="XLM"
              label="Network Reserve"
              value={balances ? fmtN(xlmBalance, 4) : null}
              error={balErr}
            />
            <BalanceTile
              symbol="EPWR"
              label="Tokenized Energy"
              value={balances ? fmtN(eprwBalance, 2) : null}
              error={balErr}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Telem label="Wallet" value={maskAddress(publicKey)} />
            <Telem
              label="Network"
              value={isOffline ? "OFFLINE" : "CONNECTED"}
              tone={isOffline ? "warn" : "ok"}
            />
            <Telem
              label="Sync"
              value={balances ? `${balances.latency_ms} ms` : "—"}
              tone={balances && balances.latency_ms < 800 ? "ok" : "warn"}
            />
            <Telem label="Subentries" value={balances ? String(balances.subentry_count) : "—"} />
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

        <Card className="relative overflow-hidden border-border bg-card p-4">
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              AI · Forecast & Market Signal
            </p>
            <h2 className="mt-0.5 font-display text-base font-semibold">Projected Operations</h2>

            <div className="mt-3 space-y-2.5">
              <ForecastRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Generation forecast · next 24h"
                value={`${fmtN(telemetry.forecastNext24Mwh, 2)} MWh`}
              />
              <ForecastRow
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Estimated EPWR production"
                value={`${fmtN(telemetry.forecastEprw, 0)} EPWR`}
              />
              <DemandBar
                label="Market demand index"
                value={telemetry.marketDemandIndex}
                tone="primary"
              />
              <DemandBar
                label="Liquidity availability"
                value={telemetry.liquidityIndex}
                tone="success"
              />
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Cpu className="h-3 w-3" />
              Inferred from rolling 24h telemetry
            </div>
          </div>
        </Card>
      </div>

      {/* Settlement feed + EPWR transactions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Settlement Rail · Recent activity
              </p>
              <h2 className="mt-0.5 font-display text-base font-semibold">Latest Energy Settlements</h2>
            </div>
            <Link
              to="/wallet"
              className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              Full feed
              <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3">
            {actErr && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <p className="text-xs text-muted-foreground">{actErr}</p>
              </div>
            )}
            {!actErr && recentSettlements.length === 0 && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            <div className="space-y-2">
              {recentSettlements.map((ev) => (
                <a
                  key={ev.id}
                  href={stellarExpertTx(ev.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-background/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        ev.successful ? "bg-success animate-pulse" : "bg-destructive"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold truncate">{ev.title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {ev.detail}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ev.amount && ev.asset && (
                      <p className="font-mono text-xs">
                        {fmtN(Number(ev.amount), 2)} {ev.asset}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground">
                      tx {ev.tx_hash.slice(0, 6)}…{ev.tx_hash.slice(-4)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            EPWR Issuance · Hourly
          </p>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetry.hourlySeries} margin={{ top: 10, right: 0, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="hour" hide />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Telem label="Avg / hr" value={`${fmtN(telemetry.eprwGenerated / 24, 0)} EPWR`} />
            <Telem label="Sync" value={new Date(telemetry.syncedAt).toUTCString().slice(17, 25)} />
          </div>
        </Card>
      </div>

      {/* SECTION 5 — AI Forecasting + SECTION 2 — Live Settlement Feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AIForecastPanel
            hourlySeries={telemetry.hourlySeries}
            forecastNext24Mwh={telemetry.forecastNext24Mwh}
            forecastEprw={telemetry.forecastEprw}
            marketDemandIndex={telemetry.marketDemandIndex}
            liquidityIndex={telemetry.liquidityIndex}
          />
        </div>
        <LiveSettlementFeed
          events={events}
          loading={actLoading}
          error={actErr}
          fetchedAt={actFetchedAt}
        />
      </div>
    </div>
  );
}

/* --------------------------------- bits --------------------------------- */

function KpiCard({
  label,
  value,
  unit,
  icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warn";
  sub?: string;
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warn"
      ? "text-amber-500"
      : "text-primary";
  return (
    <Card className="relative overflow-hidden border-border bg-card p-4">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span className={`flex h-6 w-6 items-center justify-center rounded-md border border-border ${toneCls}`}>
          {icon}
        </span>
      </div>
      <div className="relative mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tracking-tight">{value}</span>
        {unit && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {sub && <p className="relative mt-1 font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function SourceRow({
  icon,
  label,
  pct,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  tone: "primary" | "success";
}) {
  const bar = tone === "success" ? "bg-success" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs">
          {icon}
          {label}
        </span>
        <span className="font-mono text-[11px]">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: "primary" | "success"; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          color === "success" ? "bg-success" : "bg-primary"
        }`}
      />
      {label}
    </span>
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

function Telem({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const cls =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 truncate font-mono text-[11px] ${cls}`}>{value}</p>
    </div>
  );
}

function ForecastRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[11px] text-foreground">{value}</span>
    </div>
  );
}

function DemandBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success";
}) {
  const bar = tone === "success" ? "bg-success" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{value}/100</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RailIndicator({ state }: { state: string }) {
  const ok = state === "CONNECTED";
  const warn = state === "DEGRADED";
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] uppercase tracking-widest ${
        ok
          ? "border-success/40 text-success"
          : warn
          ? "border-amber-500/40 text-amber-500"
          : "border-destructive/40 text-destructive"
      }`}
    >
      {ok ? <CheckCircle2 className="mr-1.5 h-3 w-3" /> : <AlertTriangle className="mr-1.5 h-3 w-3" />}
      Rail · {state}
    </Badge>
  );
}
