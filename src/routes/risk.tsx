import { createFileRoute } from "@tanstack/react-router";
import { Panel, KpiStrip, KpiTile, SeverityBadge, CellNum, StatusDot } from "@/components/ops/primitives";
import { COUNTERPARTIES, fmtBRLm, fmtNum, fmtPct } from "@/lib/institutional-data";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk & Collateral Management — EnergyPay" },
      { name: "description", content: "Counterparty risk, credit exposure, collateral ratios and settlement guarantees." },
    ],
  }),
  component: RiskPage,
});

const TENORS = ["D+1", "D+7", "D+30", "D+90", "D+180"];

function RiskPage() {
  const totalExp = COUNTERPARTIES.reduce((a, c) => a + c.exposureBRL, 0);
  const totalColl = COUNTERPARTIES.reduce((a, c) => a + c.collateralBRL, 0);
  const restricted = COUNTERPARTIES.filter((c) => c.status === "RESTRICTED").length;
  const monitored = COUNTERPARTIES.filter((c) => c.status === "MONITOR").length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Risk Office · Counterparty & Collateral</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Risk & Collateral Management</h1>
        </div>
        <SeverityBadge level={restricted > 0 ? "WARN" : "OK"} label={`${monitored} MONITOR · ${restricted} RESTRICTED`} />
      </div>

      <KpiStrip>
        <KpiTile label="Aggregate Exposure" value={fmtBRLm(totalExp)} unit="BRL" tone="primary" />
        <KpiTile label="Pledged Collateral" value={fmtBRLm(totalColl)} unit="BRL" tone="ok" />
        <KpiTile label="System Coverage" value={`${((totalColl / totalExp) * 100).toFixed(1)}%`} tone="ok" />
        <KpiTile label="Settlement Guarantee" value={fmtBRLm(420_000_000)} unit="BRL" tone="primary" sub="multi-tier waterfall" />
        <KpiTile label="Default Pool Util." value="11%" tone="ok" sub="T2 unactivated" />
        <KpiTile label="VaR · 95% · 1d" value={fmtBRLm(12_840_000)} tone="warn" sub="parametric · normal" />
      </KpiStrip>

      <Panel title="Counterparty Risk Register" subtitle="Exposure · collateral · default probability · settlement confidence">
        <div className="overflow-x-auto">
          <table className="table-inst w-full">
            <thead>
              <tr>
                <th>Counterparty</th>
                <th>Type</th>
                <th>Rating</th>
                <th className="!text-right">Exposure</th>
                <th className="!text-right">Collateral</th>
                <th className="!text-right">Ratio</th>
                <th className="!text-right">PD (bps)</th>
                <th className="!text-right">Settle Conf.</th>
                <th className="!text-right">Open Contracts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COUNTERPARTIES.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="font-display font-medium">{c.shortName}</span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{c.id}</span>
                  </td>
                  <td className="font-mono text-[10px] uppercase text-muted-foreground">{c.type}</td>
                  <td><SeverityBadge level={c.rating === "AAA" || c.rating === "AA" ? "OK" : c.rating === "A" ? "INFO" : "WARN"} label={c.rating} /></td>
                  <td className="text-right"><CellNum>{fmtBRLm(c.exposureBRL)}</CellNum></td>
                  <td className="text-right"><CellNum>{fmtBRLm(c.collateralBRL)}</CellNum></td>
                  <td className="text-right"><CellNum tone={c.collateralRatio < 1 ? "bad" : c.collateralRatio < 1.1 ? "warn" : "ok"}>{c.collateralRatio.toFixed(2)}×</CellNum></td>
                  <td className="text-right"><CellNum tone={c.defaultProbBps > 80 ? "warn" : "default"}>{c.defaultProbBps}</CellNum></td>
                  <td className="text-right"><CellNum tone={c.settlementConfidence < 75 ? "warn" : "ok"}>{fmtPct(c.settlementConfidence, 0)}</CellNum></td>
                  <td className="text-right"><CellNum>{c.openContracts}</CellNum></td>
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="Exposure Heatmap" subtitle="Counterparty × tenor bucket · BRL" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="label-op p-2 text-left">Counterparty</th>
                  {TENORS.map((t) => <th key={t} className="label-op p-2 text-right">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {COUNTERPARTIES.slice(0, 10).map((c, i) => {
                  const total = c.exposureBRL;
                  // distribute exposure across tenors deterministically
                  const buckets = TENORS.map((_, j) => Math.round(total * (0.34 - j * 0.06 + ((i + j) % 3) * 0.02)));
                  const max = Math.max(...buckets);
                  return (
                    <tr key={c.id}>
                      <td className="border-b border-border/60 px-2 py-1.5 text-[11.5px]">{c.shortName}</td>
                      {buckets.map((b, j) => {
                        const intensity = Math.max(0, Math.min(1, b / max));
                        return (
                          <td key={j} className="border-b border-border/60 px-1 py-1.5 text-right">
                            <div
                              className="ml-auto inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] tabular"
                              style={{
                                background: `color-mix(in oklab, var(--primary) ${Math.round(intensity * 55)}%, transparent)`,
                                color: intensity > 0.55 ? "oklch(0.14 0.02 250)" : "var(--foreground)",
                              }}
                            >
                              {fmtBRLm(b)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Default Waterfall Simulation" subtitle="Counterparty stress · cascade absorption">
          <div className="space-y-2">
            {[
              { name: "Defaulter Initial Margin", abs: 38, tot: 100 },
              { name: "Defaulter Default Fund",   abs: 27, tot: 100 },
              { name: "CCP Skin-in-the-Game",     abs: 18, tot: 100 },
              { name: "Mutualized Default Fund",  abs: 11, tot: 100 },
              { name: "Recovery / Assessment",    abs: 6,  tot: 100 },
            ].map((w) => (
              <div key={w.name}>
                <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{w.name}</span>
                  <span>{w.abs}% absorbed</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${w.abs}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-3 rounded-sm border border-warning/40 bg-warning/5 p-2 text-[11px]">
              <p className="font-mono text-[9.5px] uppercase tracking-widest text-warning">Scenario · Comerc default</p>
              <p className="mt-1 text-muted-foreground leading-snug">
                Loss absorbed at tier 3 — no mutualized exposure required. System remains within tolerance.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
