import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Panel, KpiStrip, KpiTile, SeverityBadge, StatusDot, CellNum } from "@/components/ops/primitives";
import { buildPldSeries, fmtUTC, SUBMERCADOS } from "@/lib/institutional-data";

export const Route = createFileRoute("/oracle")({
  head: () => ({
    meta: [
      { title: "Oracle & Market Data — EnergyPay" },
      { name: "description", content: "PLD reference feeds, oracle integrity, latency analysis and regional pricing." },
    ],
  }),
  component: OraclePage,
});

const FEED_KEY = { "SE/CO": "SECO", S: "S", NE: "NE", N: "N" } as const;

function OraclePage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 6000);
    return () => window.clearInterval(id);
  }, []);
  const pld = useMemo(() => buildPldSeries(48, 0xa11ce + tick), [tick]);
  const latest = pld[pld.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Oracle Center · PLD Reference · ONS / CCEE</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Oracle & Market Data Center</h1>
        </div>
        <SeverityBadge level="WARN" label="1 FEED DEGRADED · FALLBACK ARMED" />
      </div>

      <KpiStrip>
        {SUBMERCADOS.map((sm) => {
          const k = FEED_KEY[sm];
          const v = latest[k as "SECO" | "S" | "NE" | "N"];
          return <KpiTile key={sm} label={`PLD · ${sm}`} value={`R$ ${v}`} unit="/MWh" tone={sm === "NE" ? "warn" : "primary"} sub={sm === "NE" ? "feed latency above SLA" : "nominal"} />;
        })}
        <KpiTile label="Oracle Integrity" value="99.94%" tone="ok" sub="rolling 24h" />
        <KpiTile label="Active Fallbacks" value="1" tone="warn" sub="Fallback B engaged" />
      </KpiStrip>

      <Panel title="PLD Historical Curve" subtitle="48-hour reference price · per submercado">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pld} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.27 0.02 250)" />
              <XAxis dataKey="t" tickFormatter={(t) => fmtUTC(t)} stroke="oklch(0.55 0.02 240)" fontSize={10} />
              <YAxis stroke="oklch(0.55 0.02 240)" fontSize={10} unit="" />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.022 250)", border: "1px solid oklch(0.28 0.02 250)", fontSize: 11 }} labelFormatter={(t) => fmtUTC(t as string) + " UTC"} />
              <Line type="monotone" dataKey="SECO" stroke="oklch(0.78 0.13 215)" strokeWidth={1.5} dot={false} name="SE/CO" />
              <Line type="monotone" dataKey="S"    stroke="oklch(0.76 0.16 150)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="NE"   stroke="oklch(0.66 0.22 25)"  strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="N"    stroke="oklch(0.82 0.16 75)"  strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel title="Feed Monitor" subtitle="Per-source latency · divergence · health">
          <div className="overflow-x-auto">
            <table className="table-inst w-full">
              <thead>
                <tr><th>Source</th><th>Feed</th><th className="!text-right">Latency</th><th className="!text-right">Divergence</th><th>State</th></tr>
              </thead>
              <tbody>
                {[
                  { src: "ONS",  feed: "PLD-SECO", lat: 412,  div: 0.04, ok: true  },
                  { src: "ONS",  feed: "PLD-S",    lat: 388,  div: 0.02, ok: true  },
                  { src: "ONS",  feed: "PLD-NE",   lat: 1640, div: 0.18, ok: false },
                  { src: "ONS",  feed: "PLD-N",    lat: 502,  div: 0.06, ok: true  },
                  { src: "CCEE", feed: "Fallback A", lat: 980, div: 0.07, ok: true },
                  { src: "CCEE", feed: "Fallback B", lat: 720, div: 0.09, ok: true },
                  { src: "BCB",  feed: "IPCA Ref",   lat: 240, div: 0.01, ok: true },
                  { src: "BCB",  feed: "SELIC",      lat: 280, div: 0.00, ok: true },
                ].map((f) => (
                  <tr key={f.feed}>
                    <td className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{f.src}</td>
                    <td>{f.feed}</td>
                    <td className="text-right"><CellNum tone={f.lat > 1000 ? "warn" : "default"}>{f.lat} ms</CellNum></td>
                    <td className="text-right"><CellNum tone={f.div > 0.1 ? "warn" : "default"}>{f.div}%</CellNum></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot tone={f.ok ? "ok" : "warn"} />
                        <span className="font-mono text-[10px] uppercase tracking-widest">{f.ok ? "VERIFIED" : "DEGRADED"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Regional Pricing Map" subtitle="Latest PLD · per submercado">
          <div className="grid grid-cols-2 gap-2">
            {SUBMERCADOS.map((sm) => {
              const k = FEED_KEY[sm];
              const v = latest[k as "SECO" | "S" | "NE" | "N"];
              const prev = pld[pld.length - 2][k as "SECO" | "S" | "NE" | "N"];
              const delta = v - prev;
              return (
                <div key={sm} className="rounded-sm border border-border bg-background/40 p-3">
                  <p className="label-op">Submercado · {sm}</p>
                  <div className="mt-1 flex items-end justify-between">
                    <span className="kpi-num text-2xl font-semibold">R$ {v}</span>
                    <span className={`font-mono text-[11px] ${delta >= 0 ? "text-success" : "text-destructive"}`}>
                      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    vs previous hour · /MWh
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-3 text-[11px]">
            <div className="flex justify-between">
              <span className="label-op">Settlement reference</span>
              <span className="font-mono">PLD horário · ONS canonical</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="label-op">Last commit</span>
              <span className="font-mono text-muted-foreground">{fmtUTC(latest.t)} UTC</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
