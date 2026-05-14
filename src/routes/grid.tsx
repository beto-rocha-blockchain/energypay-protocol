import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity, Radio, Sun, Droplets, Wind, Flame, Network, Building2, Coins,
  LineChart, Plug, Factory, MapPin, Signal, Zap, ExternalLink, ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  useGrid, projectCoords, ENERGY_LABEL, STATUS_TONE,
  type GridNode, type EnergyType, type NodeStatus,
} from "@/store/grid";
import { useOperator, maskAddress } from "@/store/operator";
import type { ParticipantRole } from "@/store/operator";

export const Route = createFileRoute("/grid")({
  component: GridPage,
});

const ROLE_ICON: Record<ParticipantRole, React.ComponentType<{ className?: string }>> = {
  GENERATOR: Factory, SELLER: Coins, INVESTOR: LineChart, USER: Plug,
};

const ENERGY_ICON: Record<EnergyType, React.ComponentType<{ className?: string }>> = {
  SOLAR: Sun, HYDRO: Droplets, WIND: Wind, THERMAL: Flame, GRID: Network,
};

const TONE_CLASS = {
  success: { dot: "bg-success", text: "text-success", border: "border-success/40", glow: "shadow-[0_0_18px_oklch(0.78_0.18_145/0.55)]" },
  warning: { dot: "bg-warning", text: "text-warning", border: "border-warning/40", glow: "shadow-[0_0_18px_oklch(0.82_0.16_75/0.45)]" },
  destructive: { dot: "bg-destructive", text: "text-destructive", border: "border-destructive/50", glow: "shadow-[0_0_14px_oklch(0.65_0.22_25/0.4)]" },
} as const;

function GridPage() {
  const nodes = useGrid((s) => s.nodes);
  const operator = useOperator((s) => s.operator);
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [filterRole, setFilterRole] = useState<"ALL" | ParticipantRole>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | NodeStatus>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      nodes.filter((n) => {
        if (filterRole !== "ALL" && n.role !== filterRole) return false;
        if (filterStatus !== "ALL" && n.status !== filterStatus) return false;
        if (query && !`${n.organization} ${n.region} ${n.id}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [nodes, filterRole, filterStatus, query],
  );

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? filtered[0] ?? nodes[0],
    [nodes, selectedId, filtered],
  );

  const stats = useMemo(() => {
    const total = nodes.length;
    const active = nodes.filter((n) => n.status === "ACTIVE").length;
    const generators = nodes.filter((n) => n.role === "GENERATOR");
    const capacity = generators.reduce((s, n) => s + n.capacityMW, 0);
    const degraded = nodes.filter((n) => n.status === "DEGRADED").length;
    const offline = nodes.filter((n) => n.status === "OFFLINE").length;
    return { total, active, capacity, degraded, offline, generators: generators.length };
  }, [nodes]);

  const operatorPos = operator?.coords ? projectCoords(operator.coords.lat, operator.coords.lng) : null;

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Operational Grid · Network Map
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Settlement Network Operations Console
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <Stat label="Nodes" value={stats.total.toString()} />
          <Stat label="Active" value={stats.active.toString()} tone="success" />
          <Stat label="Degraded" value={stats.degraded.toString()} tone="warning" />
          <Stat label="Offline" value={stats.offline.toString()} tone="destructive" />
          <Stat label="Generators" value={stats.generators.toString()} />
          <Stat label="Capacity" value={`${stats.capacity.toLocaleString()} MW`} tone="success" />
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span className="text-muted-foreground">Filter</span>
          <Pill active={filterRole === "ALL"} onClick={() => setFilterRole("ALL")}>All Roles</Pill>
          {(["GENERATOR", "SELLER", "INVESTOR", "USER"] as ParticipantRole[]).map((r) => (
            <Pill key={r} active={filterRole === r} onClick={() => setFilterRole(r)}>{r}</Pill>
          ))}
          <Separator orientation="vertical" className="mx-1 h-4 bg-border" />
          <Pill active={filterStatus === "ALL"} onClick={() => setFilterStatus("ALL")}>All States</Pill>
          {(["ACTIVE", "DEGRADED", "OFFLINE"] as NodeStatus[]).map((s) => (
            <Pill key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>{s}</Pill>
          ))}
          <div className="ml-auto w-full md:w-56">
            <Input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organization or region…"
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Map */}
        <Card className="overflow-hidden border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="h-3 w-3 text-success" />
              <span>Stellar Settlement Network · Regional Topology</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> ACTIVE</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> DEGRADED</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> OFFLINE</span>
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_240)_0%,oklch(0.16_0.018_240)_75%)]">
            {/* grid overlay */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid-fine" width="5" height="5" patternUnits="userSpaceOnUse">
                  <path d="M 5 0 L 0 0 0 5" fill="none" stroke="oklch(0.28 0.02 240)" strokeWidth="0.08" />
                </pattern>
                <pattern id="grid-bold" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="oklch(0.32 0.025 240)" strokeWidth="0.18" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-fine)" />
              <rect width="100" height="100" fill="url(#grid-bold)" />

              {/* connection lines */}
              {nodes.map((n) =>
                n.connections.map((cid) => {
                  const target = nodes.find((x) => x.id === cid);
                  if (!target) return null;
                  const a = projectCoords(n.coords.lat, n.coords.lng);
                  const b = projectCoords(target.coords.lat, target.coords.lng);
                  const isActive =
                    selected && (selected.id === n.id || selected.id === target.id);
                  const stroke = isActive ? "oklch(0.78 0.18 145 / 0.85)" : "oklch(0.7 0.15 220 / 0.18)";
                  return (
                    <line
                      key={`${n.id}-${cid}`}
                      x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100}
                      stroke={stroke} strokeWidth={isActive ? 0.35 : 0.2}
                      strokeDasharray={isActive ? "0" : "0.6 0.4"}
                    />
                  );
                }),
              )}
            </svg>

            {/* Operator pin */}
            {operatorPos && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${operatorPos.x * 100}%`, top: `${operatorPos.y * 100}%` }}
              >
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full border border-accent bg-accent/30 shadow-[0_0_18px_oklch(0.7_0.15_220/0.7)]" />
                  <div className="mt-1 rounded-sm border border-accent/40 bg-background/80 px-1 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
                    YOU · {operator?.organization?.slice(0, 18)}
                  </div>
                </div>
              </div>
            )}

            {/* Nodes */}
            {filtered.map((n) => {
              const p = projectCoords(n.coords.lat, n.coords.lng);
              const tone = TONE_CLASS[STATUS_TONE[n.status]];
              const isSel = selected?.id === n.id;
              const Icon = ENERGY_ICON[n.energyType];
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  title={n.organization}
                >
                  <span className="relative flex items-center justify-center">
                    {n.status === "ACTIVE" && (
                      <span className={`absolute h-6 w-6 animate-ping rounded-full ${tone.dot} opacity-25`} />
                    )}
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${tone.border} ${
                        isSel ? `${tone.glow} scale-125` : ""
                      } bg-background`}
                    >
                      <Icon className={`h-2.5 w-2.5 ${tone.text}`} />
                    </span>
                  </span>
                  {isSel && (
                    <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-background/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-foreground">
                      {n.organization}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Footer ticker */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-success" /> Telemetry · Stellar Testnet
              </span>
              <span>Lat range −34° to +6° · Lng −75° to −33°</span>
              <span>{filtered.length} of {nodes.length} nodes visible</span>
            </div>
          </div>
        </Card>

        {/* Detail panel */}
        <Card className="flex flex-col border-border bg-card/60">
          {selected && (
            <>
              <div className="border-b border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Participant Telemetry · {selected.id}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${TONE_CLASS[STATUS_TONE[selected.status]].border} bg-background`}>
                    {(() => {
                      const Icon = ENERGY_ICON[selected.energyType];
                      return <Icon className={`h-5 w-5 ${TONE_CLASS[STATUS_TONE[selected.status]].text}`} />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-base font-semibold leading-tight">
                      {selected.organization}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {(() => {
                        const RIcon = ROLE_ICON[selected.role];
                        return (<><RIcon className="h-3 w-3" />{selected.role}</>);
                      })()}
                      <span>·</span>
                      <span>{selected.jurisdiction}</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${TONE_CLASS[STATUS_TONE[selected.status]].border} ${TONE_CLASS[STATUS_TONE[selected.status]].text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[STATUS_TONE[selected.status]].dot} ${selected.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                  <Mini label="Energy Type" value={ENERGY_LABEL[selected.energyType]} />
                  <Mini label="Capacity" value={selected.role === "GENERATOR" ? `${selected.capacityMW.toLocaleString()} MW` : "—"} tone={selected.role === "GENERATOR" ? "success" : undefined} />
                  <Mini label="Region" value={selected.region} />
                  <Mini label="Uptime" value={`${selected.uptime.toFixed(2)}%`} tone={selected.uptime >= 99.5 ? "success" : selected.uptime >= 98 ? "warning" : "destructive"} />
                  <Mini label="Connectivity" value={`${selected.connections.length} peers`} />
                  <Mini label="Last Settlement" value={`${selected.lastSettlementAgo} ago`} />
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Settlement Address
                  </div>
                  <div className="mt-1 flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1.5">
                    <code className="truncate font-mono text-[11px] text-foreground">
                      {selected.settlementAddress}
                    </code>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${selected.settlementAddress}`}
                      target="_blank" rel="noreferrer"
                      className="ml-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" /> Audit
                    </a>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {maskAddress(selected.settlementAddress)} · STELLAR TESTNET
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Recent Settlements
                  </div>
                  <div className="mt-1 space-y-1">
                    {selected.recentSettlements.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2 py-1.5 font-mono text-[11px]">
                        <span className="text-foreground">{s.id}</span>
                        <span className={s.amount < 0 ? "text-destructive" : "text-success"}>
                          {s.amount < 0 ? "-" : "+"}R$ {Math.abs(s.amount).toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">{s.ago} ago</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Network Connectivity
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selected.connections.map((cid) => {
                      const peer = nodes.find((x) => x.id === cid);
                      if (!peer) return null;
                      return (
                        <button
                          key={cid}
                          onClick={() => setSelectedId(cid)}
                          className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                        >
                          {peer.organization}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background/40 p-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Signal className="h-3 w-3 text-success" /> Telemetry Feed</span>
                    <span className="text-success">LIVE</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Coordinates</span>
                    <span className="text-foreground">{selected.coords.lat.toFixed(2)}, {selected.coords.lng.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Registry table */}
      <Card className="border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-2"><Building2 className="h-3 w-3" /> Participant Registry</span>
          <span>{filtered.length} entities</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-background/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Organization</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Energy</th>
                <th className="px-3 py-2 text-right">Capacity</th>
                <th className="px-3 py-2 text-left">Region</th>
                <th className="px-3 py-2 text-left">Settlement Address</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const tone = TONE_CLASS[STATUS_TONE[n.status]];
                const isSel = selected?.id === n.id;
                return (
                  <tr
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`cursor-pointer border-b border-border/60 transition hover:bg-background/40 ${isSel ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono text-foreground">{n.organization}</td>
                    <td className="px-3 py-2 font-mono uppercase tracking-widest text-muted-foreground">{n.role}</td>
                    <td className="px-3 py-2 font-mono uppercase tracking-widest text-muted-foreground">{n.energyType}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {n.role === "GENERATOR" ? `${n.capacityMW.toLocaleString()} MW` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{n.region}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{maskAddress(n.settlementAddress)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone.border} ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${n.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                        {n.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-success" /> Registry Read-only · Settlement Identity Bound</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-primary" /> Future API: live settlement feeds · operational telemetry · regional liquidity</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "destructive" }) {
  const t = tone ? TONE_CLASS[tone] : null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${t?.text ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2 py-0.5 transition ${
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "destructive" }) {
  const t = tone ? TONE_CLASS[tone] : null;
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[11px] ${t?.text ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
