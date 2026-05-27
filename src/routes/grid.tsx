import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { stellarExpertAccount, STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import {
  Activity,
  Radio,
  Sun,
  Droplets,
  Wind,
  Flame,
  Network,
  Building2,
  Coins,
  LineChart,
  Plug,
  Factory,
  Signal,
  Zap,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  useGrid,
  haversineKm,
  ENERGY_LABEL,
  STATUS_TONE,
  type GridNode,
  type EnergyType,
  type NodeStatus,
} from "@/store/grid";
import { useOperator, maskAddress, ROLE_COLORS } from "@/store/operator";
import type { ParticipantRole } from "@/store/operator";

// Leaflet map — client-only, loaded lazily to avoid SSR issues
const GridMapLeaflet = lazy(() => import("@/components/GridMapLeaflet"));

export const Route = createFileRoute("/grid")({
  component: GridPage,
});

const ROLE_ICON: Record<ParticipantRole, React.ComponentType<{ className?: string }>> = {
  GENERATOR: Factory,
  SELLER: Coins,
  INVESTOR: LineChart,
  USER: Plug,
  UTILITY: Building2,
};

const ENERGY_ICON: Record<EnergyType, React.ComponentType<{ className?: string }>> = {
  SOLAR: Sun,
  HYDRO: Droplets,
  WIND: Wind,
  THERMAL: Flame,
  GRID: Network,
};

const TONE_CLASS = {
  success: {
    dot: "bg-success",
    text: "text-success",
    border: "border-success/40",
    glow: "shadow-[0_0_18px_oklch(0.78_0.18_145/0.55)]",
  },
  warning: {
    dot: "bg-warning",
    text: "text-warning",
    border: "border-warning/40",
    glow: "shadow-[0_0_18px_oklch(0.82_0.16_75/0.45)]",
  },
  destructive: {
    dot: "bg-destructive",
    text: "text-destructive",
    border: "border-destructive/50",
    glow: "shadow-[0_0_14px_oklch(0.65_0.22_25/0.4)]",
  },
} as const;

function GridPage() {
  const nodes = useGrid((s) => s.nodes);
  const gridLoading = useGrid((s) => s.loading);
  const gridError = useGrid((s) => s.error);
  const fetchGrid = useGrid((s) => s.fetch);
  const operator = useOperator((s) => s.operator);

  useEffect(() => {
    if (operator) fetchGrid();
  }, [fetchGrid, operator]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"ALL" | ParticipantRole>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | NodeStatus>("ALL");
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  // Ensure Leaflet only renders client-side
  useEffect(() => { setMounted(true); }, []);

  const filtered = useMemo(
    () =>
      nodes.filter((n) => {
        if (filterRole !== "ALL" && n.role !== filterRole) return false;
        if (filterStatus !== "ALL" && n.status !== filterStatus) return false;
        if (
          query &&
          !`${n.organization} ${n.region} ${n.id}`.toLowerCase().includes(query.toLowerCase())
        )
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

  const operatorCoords = operator?.coords
    ? { lat: operator.coords.lat, lng: operator.coords.lng }
    : null;

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
          <Button size="sm" variant="outline" onClick={fetchGrid} disabled={gridLoading} className="h-7 px-2">
            <RefreshCw className={`mr-1.5 h-3 w-3 ${gridLoading ? "animate-spin" : ""}`} />
            <span className="font-mono text-[10px] uppercase tracking-widest">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span className="text-muted-foreground">Filter</span>
          <Pill active={filterRole === "ALL"} onClick={() => setFilterRole("ALL")}>
            All Roles
          </Pill>
          {(["GENERATOR", "SELLER", "INVESTOR", "USER"] as ParticipantRole[]).map((r) => (
            <Pill key={r} active={filterRole === r} onClick={() => setFilterRole(r)}>
              {r}
            </Pill>
          ))}
          <Separator orientation="vertical" className="mx-1 h-4 bg-border" />
          <Pill active={filterStatus === "ALL"} onClick={() => setFilterStatus("ALL")}>
            All States
          </Pill>
          {(["ACTIVE", "DEGRADED", "OFFLINE"] as NodeStatus[]).map((s) => (
            <Pill key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>
              {s}
            </Pill>
          ))}
          <div className="ml-auto w-full md:w-56">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organization or region…"
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
      </Card>

      {/* ── Not authenticated ─────────────────────────────────────────── */}
      {!operator ? (
        <Card className="border-border bg-card/60 p-10 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-display text-base font-semibold">Authentication required</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Sign in to view the settlement network map and participant nodes.
          </p>
        </Card>
      ) : gridLoading && nodes.length === 0 ? (
        <Card className="border-border bg-card/60 p-10 text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground/40" />
          <p className="font-mono text-sm text-muted-foreground">Loading grid participants…</p>
        </Card>
      ) : nodes.length === 0 ? (
        <Card className="border-border bg-card/60 p-10 text-center">
          {/* Distinguish expired session from "empty grid" */}
          {gridError && /bearer|token|unauthorized|401/i.test(gridError) ? (
            <>
              <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-display text-base font-semibold">Session expired</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Your session has expired. Please sign in again.
              </p>
            </>
          ) : (
            <>
              <Network className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-display text-base font-semibold">No verified participants</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Grid nodes appear here once participants verify their email during registration.
              </p>
            </>
          )}
          {gridError && !/bearer|token|unauthorized|401/i.test(gridError) && (
            <p className="mt-2 font-mono text-[11px] text-destructive">{gridError}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchGrid}
            className="mt-3 font-mono text-[10px] uppercase tracking-widest"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
          </Button>
        </Card>
      ) : (
      <>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Map — Leaflet with CartoDB dark tiles */}
        <Card className="overflow-hidden border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="h-3 w-3 text-success" />
              <span>Stellar Settlement Network · Live Map</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Generator
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#60a5fa]" /> Seller
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Investor
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#94a3b8]" /> Consumer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#fb923c]" /> Utility
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#06b6d4]" /> You
              </span>
            </div>
          </div>
          {/* Map container — fixed height, Leaflet fills it */}
          <div className="relative h-[420px] w-full overflow-hidden">
            {mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-[#0d1117]">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/40" />
                  </div>
                }
              >
                <GridMapLeaflet
                  nodes={filtered}
                  operatorCoords={operatorCoords}
                  operatorName={operator?.organization ?? ""}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0d1117]">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/40" />
              </div>
            )}
            {/* Overlay footer ticker — z-index above Leaflet tiles but below controls */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border bg-background/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur"
              style={{ zIndex: 450 }}
            >
              <span className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-success" /> Live · {STELLAR_NETWORK_LABEL}
              </span>
              <span className="hidden md:block">Click a node to inspect · Scroll to zoom</span>
              <span>
                {filtered.length} of {nodes.length} nodes visible
              </span>
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
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-md border ${TONE_CLASS[STATUS_TONE[selected.status]].border} bg-background`}
                  >
                    {(() => {
                      const Icon = ENERGY_ICON[selected.energyType];
                      return (
                        <Icon
                          className={`h-5 w-5 ${TONE_CLASS[STATUS_TONE[selected.status]].text}`}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-base font-semibold leading-tight">
                      {selected.organization}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {(() => {
                        const RIcon = ROLE_ICON[selected.role];
                        return (
                          <>
                            <RIcon className="h-3 w-3" />
                            {selected.role}
                          </>
                        );
                      })()}
                      <span>·</span>
                      <span>{selected.jurisdiction}</span>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${TONE_CLASS[STATUS_TONE[selected.status]].border} ${TONE_CLASS[STATUS_TONE[selected.status]].text}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[STATUS_TONE[selected.status]].dot} ${selected.status === "ACTIVE" ? "animate-pulse" : ""}`}
                    />
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
                  <Mini label="Energy Type" value={ENERGY_LABEL[selected.energyType]} />
                  <Mini label="Region" value={selected.region} />
                  <Mini label="Connectivity" value={`${selected.connections.length} peers`} />
                  <Mini
                    label="Location"
                    value={selected.approximateLocation ? "≈ City-level" : "GPS · Exact"}
                    tone={selected.approximateLocation ? "warning" : "success"}
                  />
                  {operatorCoords && (
                    <Mini
                      label="Distance"
                      value={`${Math.round(haversineKm(operatorCoords.lat, operatorCoords.lng, selected.coords.lat, selected.coords.lng)).toLocaleString()} km`}
                      tone="success"
                    />
                  )}
                  <Mini
                    label="Coordinates"
                    value={`${selected.coords.lat.toFixed(2)}, ${selected.coords.lng.toFixed(2)}`}
                  />
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
                      href={stellarExpertAccount(selected.settlementAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" /> Audit
                    </a>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {maskAddress(selected.settlementAddress)} · {STELLAR_NETWORK_LABEL}
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
                    <span className="flex items-center gap-1.5">
                      <Signal className="h-3 w-3 text-success" /> Settlement Network
                    </span>
                    <span className="text-success">{STELLAR_NETWORK_LABEL}</span>
                  </div>
                  {selected.approximateLocation && (
                    <div className="mt-1 text-[9px] text-warning/80">
                      ⚠ Location is city-level approximate — participant has not provided GPS coordinates.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Registry table */}
      <Card className="border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-2">
            <Building2 className="h-3 w-3" /> Participant Registry
          </span>
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
                    <td className={`px-3 py-2 font-mono uppercase tracking-widest ${ROLE_COLORS[n.role]?.text ?? "text-muted-foreground"}`}>
                      {n.role}
                    </td>
                    <td className="px-3 py-2 font-mono uppercase tracking-widest text-muted-foreground">
                      {n.energyType}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {n.role === "GENERATOR" ? `${n.capacityMW.toLocaleString()} MW` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{n.region}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {maskAddress(n.settlementAddress)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone.border} ${tone.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${n.status === "ACTIVE" ? "animate-pulse" : ""}`}
                        />
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
      </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-success" /> Registry Read-only · Settlement Identity
          Bound
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> {STELLAR_NETWORK_LABEL}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const t = tone ? TONE_CLASS[tone] : null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${t?.text ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const t = tone ? TONE_CLASS[tone] : null;
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[11px] ${t?.text ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
