import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Activity } from "lucide-react";

type Region = {
  id: string;
  name: string;
  cx: number;
  cy: number;
  baseLoadMw: number;
};

const REGIONS: Region[] = [
  { id: "N",  name: "Norte",     cx: 200, cy: 90,  baseLoadMw: 18_400 },
  { id: "NE", name: "Nordeste",  cx: 320, cy: 130, baseLoadMw: 22_900 },
  { id: "CO", name: "Centro-Oeste", cx: 220, cy: 200, baseLoadMw: 14_300 },
  { id: "SE", name: "Sudeste",   cx: 290, cy: 240, baseLoadMw: 41_700 },
  { id: "S",  name: "Sul",       cx: 240, cy: 310, baseLoadMw: 19_600 },
];

// Simplified Brazil silhouette path
const BRAZIL_PATH =
  "M150,80 Q175,55 220,55 L260,50 Q310,55 340,80 L370,120 Q380,160 360,200 L355,235 Q345,275 320,310 L290,345 Q260,360 220,355 L180,340 Q150,320 140,285 L130,240 Q120,200 130,160 L140,120 Z";

const TRANSMISSION = [
  ["N", "NE"],
  ["N", "CO"],
  ["NE", "SE"],
  ["CO", "SE"],
  ["SE", "S"],
  ["CO", "S"],
] as const;

const findRegion = (id: string) => REGIONS.find((r) => r.id === id)!;

const statusOf = (load: number, base: number): "ONLINE" | "DEGRADED" | "OVERLOAD" => {
  const r = load / base;
  if (r > 1.15) return "OVERLOAD";
  if (r < 0.7) return "DEGRADED";
  return "ONLINE";
};

const colorFor = (s: "ONLINE" | "DEGRADED" | "OVERLOAD") =>
  s === "ONLINE" ? "var(--success)" : s === "OVERLOAD" ? "var(--destructive)" : "var(--warning)";

export function BrazilGridMap() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2_500);
    return () => window.clearInterval(id);
  }, []);

  const data = useMemo(
    () =>
      REGIONS.map((r, i) => {
        const drift = (Math.sin(tick * 0.5 + i) + 1) / 2;
        const load = Math.round(r.baseLoadMw * (0.78 + drift * 0.45));
        const status = statusOf(load, r.baseLoadMw);
        return { ...r, loadMw: load, status };
      }),
    [tick],
  );

  const total = data.reduce((a, r) => a + r.loadMw, 0);

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ONS · National Interconnected System · SCADA Overlay
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold">Regional Generation & Settlement Map</h2>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
          <Badge variant="outline" className="border-border">
            <Activity className="mr-1.5 h-3 w-3 text-success animate-pulse" />
            LIVE
          </Badge>
          <Badge variant="outline" className="border-border">
            <Radio className="mr-1.5 h-3 w-3 text-primary" />
            {(total / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} GW dispatch
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-md border border-border bg-background/40 lg:col-span-2">
          <div className="terminal-grid-bg absolute inset-0 opacity-40" />
          <svg viewBox="0 0 500 380" className="relative h-[340px] w-full">
            <defs>
              <linearGradient id="brazil-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.18 145)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="oklch(0.7 0.15 220)" stopOpacity="0.05" />
              </linearGradient>
              <radialGradient id="node-glow">
                <stop offset="0%" stopColor="oklch(0.78 0.18 145)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="oklch(0.78 0.18 145)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <path
              d={BRAZIL_PATH}
              fill="url(#brazil-fill)"
              stroke="oklch(0.4 0.04 240)"
              strokeWidth="1"
            />

            {/* Transmission lines */}
            {TRANSMISSION.map(([a, b], i) => {
              const ra = findRegion(a);
              const rb = findRegion(b);
              return (
                <g key={`${a}-${b}`}>
                  <line
                    x1={ra.cx}
                    y1={ra.cy}
                    x2={rb.cx}
                    y2={rb.cy}
                    stroke="oklch(0.4 0.04 240)"
                    strokeWidth="1"
                  />
                  <line
                    x1={ra.cx}
                    y1={ra.cy}
                    x2={rb.cx}
                    y2={rb.cy}
                    stroke="oklch(0.78 0.18 145)"
                    strokeWidth="1.5"
                    strokeDasharray="6 8"
                    strokeOpacity="0.85"
                    className="animate-flow-dash"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                </g>
              );
            })}

            {/* Region nodes */}
            {data.map((r) => (
              <g key={r.id}>
                <circle cx={r.cx} cy={r.cy} r={18} fill="url(#node-glow)" />
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={6}
                  fill={colorFor(r.status)}
                  className="animate-node-pulse"
                  style={{ animationDelay: `${r.cx * 0.003}s` }}
                />
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={2.5}
                  fill="oklch(0.96 0.005 240)"
                />
                <text
                  x={r.cx + 14}
                  y={r.cy - 8}
                  fill="oklch(0.88 0.01 240)"
                  fontSize="11"
                  fontFamily="var(--font-display)"
                  fontWeight={600}
                >
                  {r.name}
                </text>
                <text
                  x={r.cx + 14}
                  y={r.cy + 6}
                  fill="oklch(0.68 0.02 240)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {(r.loadMw / 1000).toFixed(1)} GW
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-2">
          {data.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border bg-background/40 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: colorFor(r.status) }}
                  />
                  {r.name}
                </span>
                <span
                  className="font-mono text-[9px] uppercase tracking-widest"
                  style={{ color: colorFor(r.status) }}
                >
                  {r.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>Dispatch</span>
                <span className="text-foreground">{r.loadMw.toLocaleString("en-US")} MW</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (r.loadMw / r.baseLoadMw) * 100)}%`,
                    background: colorFor(r.status),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
