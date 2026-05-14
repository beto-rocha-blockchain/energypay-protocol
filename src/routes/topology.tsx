import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, KpiStrip, KpiTile, SeverityBadge, StatusDot, CellNum } from "@/components/ops/primitives";
import { TOPO_NODES, TOPO_EDGES, fmtNum, type TopoNode } from "@/lib/institutional-data";
import { Factory, Building2, Briefcase, Home, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/topology")({
  head: () => ({
    meta: [
      { title: "Energy Network Topology — EnergyPay" },
      { name: "description", content: "Interactive regional SCADA topology of generators, distributors, traders, consumers and investors." },
    ],
  }),
  component: TopologyPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  GENERATOR: Factory, DISTRIBUTOR: Building2, TRADER: Briefcase, RETAILER: Users, CONSUMER: Home, INVESTOR: Wallet,
};

const typeColor = (t: string) =>
  t === "GENERATOR" ? "oklch(0.76 0.16 150)" :
  t === "DISTRIBUTOR" ? "oklch(0.78 0.13 215)" :
  t === "TRADER" ? "oklch(0.82 0.16 75)" :
  t === "RETAILER" ? "oklch(0.72 0.15 290)" :
  t === "CONSUMER" ? "oklch(0.86 0.04 240)" :
  "oklch(0.66 0.22 25)";

function TopologyPage() {
  const [sel, setSel] = useState<TopoNode>(TOPO_NODES[4]);
  const onlineCount = TOPO_NODES.filter((n) => n.status === "ONLINE").length;
  const degradedCount = TOPO_NODES.filter((n) => n.status === "DEGRADED").length;
  const totalLoad = TOPO_NODES.reduce((a, n) => a + n.loadMw, 0);
  const flowing = TOPO_EDGES.filter((e) => e.status === "FLOWING").length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">SCADA · National Interconnected System</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Energy Network Topology</h1>
        </div>
        <SeverityBadge level={degradedCount > 0 ? "WARN" : "OK"} label={`${degradedCount} DEGRADED · ${onlineCount} ONLINE`} />
      </div>

      <KpiStrip>
        <KpiTile label="Total Nodes" value={TOPO_NODES.length} tone="primary" />
        <KpiTile label="Online" value={onlineCount} tone="ok" />
        <KpiTile label="Degraded" value={degradedCount} tone="warn" />
        <KpiTile label="Corridors Flowing" value={`${flowing}/${TOPO_EDGES.length}`} tone="ok" />
        <KpiTile label="Aggregate Dispatch" value={fmtNum(totalLoad)} unit="MW" tone="primary" />
        <KpiTile label="Submercados" value="4" sub="SE/CO · S · NE · N" />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Panel title="Regional SCADA Map" subtitle="Topology · live participant + corridor state" className="xl:col-span-3">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-sm border border-border bg-background/40 grid-bg">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              {/* Submercado outlines */}
              {[
                { d: "M 20 8 L 90 8 L 90 35 L 50 35 L 50 28 L 20 28 Z", label: "N" },
                { d: "M 50 28 L 90 35 L 90 50 L 60 52 Z", label: "NE" },
                { d: "M 20 28 L 50 28 L 60 52 L 60 78 L 20 78 Z", label: "SE/CO" },
                { d: "M 20 78 L 60 78 L 60 95 L 20 95 Z", label: "S" },
              ].map((r) => (
                <path key={r.label} d={r.d} fill="oklch(0.18 0.022 250)" stroke="oklch(0.28 0.02 250)" strokeWidth={0.25} />
              ))}

              {/* Corridors */}
              {TOPO_EDGES.map((e, i) => {
                const a = TOPO_NODES.find((n) => n.id === e.from)!;
                const b = TOPO_NODES.find((n) => n.id === e.to)!;
                const stroke = e.status === "STRESSED" ? "oklch(0.66 0.22 25)" : e.status === "STANDBY" ? "oklch(0.45 0.02 240)" : "oklch(0.78 0.13 215)";
                return (
                  <g key={i}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={0.4} strokeDasharray="1.4 1.4" className={e.status === "FLOWING" ? "animate-flow-dash" : ""} />
                  </g>
                );
              })}

              {/* Nodes */}
              {TOPO_NODES.map((n) => (
                <g key={n.id} onClick={() => setSel(n)} style={{ cursor: "pointer" }}>
                  <circle cx={n.x} cy={n.y} r={sel.id === n.id ? 2.4 : 1.6} fill={typeColor(n.type)} stroke="oklch(0.14 0.02 250)" strokeWidth={0.3} />
                  {n.status === "DEGRADED" && (
                    <circle cx={n.x} cy={n.y} r={3} fill="none" stroke="oklch(0.82 0.16 75)" strokeWidth={0.3} className="animate-pulse" />
                  )}
                </g>
              ))}
            </svg>

            {/* Submercado labels */}
            <span className="absolute left-[42%] top-[5%] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">N</span>
            <span className="absolute right-[6%] top-[20%] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">NE</span>
            <span className="absolute left-[34%] top-[55%] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">SE / CO</span>
            <span className="absolute left-[34%] bottom-[6%] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">S</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {["GENERATOR","DISTRIBUTOR","TRADER","RETAILER","CONSUMER","INVESTOR"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: typeColor(t) }} /> {t}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Node Inspector" subtitle="Selected participant telemetry">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-background/60">
              {(() => { const I = ICONS[sel.type] ?? Factory; return <I className="h-4 w-4 text-primary" />; })()}
            </div>
            <div>
              <p className="text-[13px] font-semibold">{sel.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{sel.id} · {sel.type}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
            <dt className="label-op">Submercado</dt><dd className="font-mono">{sel.submercado}</dd>
            <dt className="label-op">Status</dt>
            <dd className="inline-flex items-center gap-1.5">
              <StatusDot tone={sel.status === "ONLINE" ? "ok" : sel.status === "DEGRADED" ? "warn" : "bad"} />
              <span className="font-mono text-[10px] uppercase tracking-widest">{sel.status}</span>
            </dd>
            <dt className="label-op">Dispatch</dt><dd><CellNum>{fmtNum(sel.loadMw)} MW</CellNum></dd>
            <dt className="label-op">Settlement Conn</dt><dd><CellNum tone="ok">VERIFIED</CellNum></dd>
            <dt className="label-op">Trustline</dt><dd className="font-mono text-[10px]">EPWR · OK</dd>
            <dt className="label-op">Last Heartbeat</dt><dd className="font-mono text-[10px]">3.2s ago</dd>
          </dl>
          <div className="mt-3 border-t border-border pt-3">
            <p className="label-op mb-1">Connected Corridors</p>
            <ul className="space-y-1 font-mono text-[10.5px]">
              {TOPO_EDGES.filter((e) => e.from === sel.id || e.to === sel.id).map((e, i) => (
                <li key={i} className="flex justify-between">
                  <span>{e.from === sel.id ? `→ ${e.to}` : `← ${e.from}`}</span>
                  <span className={e.status === "STRESSED" ? "text-destructive" : e.status === "STANDBY" ? "text-muted-foreground" : "text-success"}>
                    {fmtNum(e.mw)} MW · {e.status}
                  </span>
                </li>
              ))}
              {TOPO_EDGES.filter((e) => e.from === sel.id || e.to === sel.id).length === 0 && (
                <li className="text-muted-foreground">No active corridors</li>
              )}
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
