import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import {
  Panel, KpiStrip, KpiTile, SeverityBadge, StatusDot, Sparkline, CellNum,
} from "@/components/ops/primitives";
import {
  buildThroughput, OPS_ALERTS, COUNTERPARTIES, RECON_EXCEPTIONS,
  fmtBRLm, fmtNum, fmtUTC, fmtPct,
} from "@/lib/institutional-data";
import { useSettlementRail } from "@/hooks/useSettlementRail";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Market Operations Center — EnergyPay" },
      { name: "description", content: "Real-time settlement throughput, cleared notional, exposure and operational telemetry." },
    ],
  }),
  component: MarketOpsPage,
});

function MarketOpsPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 4000);
    return () => window.clearInterval(id);
  }, []);
  const { health, telemetry } = useSettlementRail();
  const tpData = useMemo(() => buildThroughput(60, 0xdeadbeef + tick), [tick]);

  const lastTpm = tpData[tpData.length - 1]?.tpm ?? 0;
  const totalNotional = tpData.reduce((a, p) => a + p.notional, 0);
  const exposure = COUNTERPARTIES.reduce((a, c) => a + c.exposureBRL, 0);
  const collateral = COUNTERPARTIES.reduce((a, c) => a + c.collateralBRL, 0);
  const reconHealth = Math.round(
    100 - (RECON_EXCEPTIONS.filter((e) => e.state !== "RESOLVED").length / RECON_EXCEPTIONS.length) * 100 + 14,
  );
  const finalityP95 = telemetry?.counters.avg_finality_ms ?? 4180;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Market Operations · Tier-1 Desk</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Market Operations Center</h1>
        </div>
        <SeverityBadge level="OK" label={`OPS NOMINAL · ${tpData.length}m WINDOW`} />
      </div>

      <KpiStrip>
        <KpiTile
          label="Cleared Notional · 60m"
          value={fmtBRLm(totalNotional)}
          unit="BRL"
          tone="primary"
          spark={<Sparkline values={tpData.map((p) => p.notional)} color="oklch(0.78 0.13 215)" />}
        />
        <KpiTile
          label="Throughput · live"
          value={lastTpm}
          unit="TX/MIN"
          tone="ok"
          spark={<Sparkline values={tpData.map((p) => p.tpm)} color="oklch(0.76 0.16 150)" />}
        />
        <KpiTile label="Open Exposure" value={fmtBRLm(exposure)} unit="BRL" tone="warn" sub="across 16 counterparties" />
        <KpiTile label="Collateral Coverage" value={`${((collateral / exposure) * 100).toFixed(1)}%`} tone="ok" sub={`${fmtBRLm(collateral)} pledged`} />
        <KpiTile label="Reconciliation Health" value={`${Math.min(99, reconHealth)}%`} tone={reconHealth > 92 ? "ok" : "warn"} sub={`${RECON_EXCEPTIONS.filter(e => e.state === "OPEN").length} open exceptions`} />
        <KpiTile label="Finality p95" value={`${(finalityP95 / 1000).toFixed(2)}s`} tone={finalityP95 < 6000 ? "ok" : "warn"} sub={`Horizon · ${health?.horizon.latency_ms ?? 0} ms`} />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="Settlement Throughput" subtitle="60-minute window · Δ tx/min · cleared notional" className="xl:col-span-2" right={<SeverityBadge level="OK" label="STREAMING" />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tpData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="thArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.13 215)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.78 0.13 215)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.27 0.02 250)" />
                <XAxis dataKey="t" tickFormatter={(t) => fmtUTC(t)} stroke="oklch(0.55 0.02 240)" fontSize={10} />
                <YAxis stroke="oklch(0.55 0.02 240)" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.18 0.022 250)", border: "1px solid oklch(0.28 0.02 250)", fontSize: 11 }}
                  labelFormatter={(t) => fmtUTC(t as string) + " UTC"}
                  formatter={(v: number, k) => k === "tpm" ? [`${v} tx/min`, "throughput"] : [v, k]}
                />
                <Area type="monotone" dataKey="tpm" stroke="oklch(0.78 0.13 215)" strokeWidth={1.5} fill="url(#thArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Operational Alerts" subtitle="Severity-coded operational stream" right={<SeverityBadge level="WARN" label={`${OPS_ALERTS.filter(a => a.severity !== "INFO").length} ACTIVE`} />}>
          <ul className="space-y-2 text-[11.5px]">
            {OPS_ALERTS.map((a) => (
              <li key={a.id} className="flex items-start gap-2 border-l-2 pl-2"
                  style={{ borderColor: a.severity === "CRITICAL" ? "var(--destructive)" : a.severity === "WARN" ? "var(--warning)" : "var(--primary)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge level={a.severity} />
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">{a.source}</span>
                  </div>
                  <p className="mt-0.5 leading-snug">{a.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{fmtUTC(a.ts)} UTC · {a.id}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="Counterparty Activity · 60m" subtitle="Cleared notional density per desk" className="xl:col-span-2">
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={COUNTERPARTIES.slice(0, 12).map(c => ({ name: c.shortName, exp: c.exposureBRL / 1_000_000 }))}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.27 0.02 250)" />
                <XAxis dataKey="name" stroke="oklch(0.55 0.02 240)" fontSize={9} angle={-22} textAnchor="end" height={50} />
                <YAxis stroke="oklch(0.55 0.02 240)" fontSize={10} unit="M" />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.022 250)", border: "1px solid oklch(0.28 0.02 250)", fontSize: 11 }} formatter={(v: number) => [`R$ ${v.toFixed(1)}M`, "exposure"]} />
                <Bar dataKey="exp" fill="oklch(0.76 0.16 150)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Liquidity Stress Monitor" subtitle="Settlement guarantee pool · margin headroom">
          <div className="space-y-3">
            {[
              { name: "Settlement Guarantee Pool", util: 71, tone: "warn" as const },
              { name: "Operational Margin Buffer", util: 42, tone: "ok" as const },
              { name: "Intraday Credit Line",      util: 58, tone: "ok" as const },
              { name: "Default Waterfall T2",      util: 11, tone: "ok" as const },
            ].map((b) => (
              <div key={b.name}>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{b.name}</span>
                  <span className={b.tone === "warn" ? "text-warning" : "text-success"}>{b.util}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-muted">
                  <div className={`h-full ${b.tone === "warn" ? "bg-warning" : "bg-success"}`} style={{ width: `${b.util}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
              <div>
                <p className="label-op">PLD intraday SE/CO</p>
                <CellNum>R$ 284 /MWh</CellNum>
              </div>
              <div>
                <p className="label-op">Reserve activations</p>
                <CellNum tone="warn">2 today</CellNum>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Counterparty Telemetry" subtitle="Top 8 by exposure · realtime margin state">
        <div className="overflow-x-auto">
          <table className="table-inst w-full">
            <thead>
              <tr>
                <th>Counterparty</th>
                <th>Type</th>
                <th>Submkt</th>
                <th>Rating</th>
                <th className="!text-right">Exposure</th>
                <th className="!text-right">Collateral</th>
                <th className="!text-right">Ratio</th>
                <th className="!text-right">Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COUNTERPARTIES.slice(0, 10).map((c) => (
                <tr key={c.id}>
                  <td><span className="font-display font-medium">{c.shortName}</span><span className="ml-2 font-mono text-[10px] text-muted-foreground">{c.id}</span></td>
                  <td className="font-mono text-[10px] uppercase text-muted-foreground">{c.type}</td>
                  <td className="font-mono text-[10px]">{c.submercado}</td>
                  <td><SeverityBadge level="OK" label={c.rating} /></td>
                  <td className="text-right"><CellNum>{fmtBRLm(c.exposureBRL)}</CellNum></td>
                  <td className="text-right"><CellNum>{fmtBRLm(c.collateralBRL)}</CellNum></td>
                  <td className="text-right"><CellNum tone={c.collateralRatio < 1 ? "bad" : c.collateralRatio < 1.1 ? "warn" : "ok"}>{c.collateralRatio.toFixed(2)}×</CellNum></td>
                  <td className="text-right"><CellNum tone={c.settlementConfidence < 70 ? "warn" : "ok"}>{fmtPct(c.settlementConfidence, 0)}</CellNum></td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot tone={c.status === "ACTIVE" ? "ok" : c.status === "MONITOR" ? "warn" : "bad"} />
                      <span className="font-mono text-[10px] uppercase tracking-widest">{c.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
