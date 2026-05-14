import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Cpu, CloudRain, AlertTriangle, TrendingUp, Zap, Droplets } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  hourlySeries: { hour: string; total: number }[];
  forecastNext24Mwh: number;
  forecastEprw: number;
  marketDemandIndex: number;
  liquidityIndex: number;
};

const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });

export function AIForecastPanel({
  hourlySeries,
  forecastNext24Mwh,
  forecastEprw,
  marketDemandIndex,
  liquidityIndex,
}: Props) {
  // synthesize 7d forecast from hourly seasonality
  const weekSeries = useMemo(() => {
    const out: { day: string; gen: number; demand: number }[] = [];
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const base = hourlySeries.reduce((a, s) => a + s.total, 0) / 1000;
    for (let i = 0; i < 7; i++) {
      const seasonal = 0.92 + Math.sin(i * 0.9) * 0.08 + Math.cos(i * 1.6) * 0.04;
      const gen = base * 24 * seasonal * 0.04;
      const demand = gen * (0.85 + Math.cos(i * 0.7) * 0.12);
      out.push({ day: days[i], gen: Math.round(gen), demand: Math.round(demand) });
    }
    return out;
  }, [hourlySeries]);

  const surplus = forecastNext24Mwh * 1000 - forecastNext24Mwh * 1000 * (marketDemandIndex / 100);
  const congestion = Math.max(0, Math.min(100, 100 - liquidityIndex + (marketDemandIndex - 60)));
  const confidence = Math.round(72 + (liquidityIndex - 60) * 0.2 + Math.sin(Date.now() / 30000) * 4);

  return (
    <Card className="relative overflow-hidden border-border bg-card p-4">
      <div className="pointer-events-none absolute inset-x-0 -top-12 h-24 bg-[image:var(--gradient-primary)] opacity-10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            AI Operational Forecasting · Predictive Layer
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold">Generation & Settlement Outlook</h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Confidence
          </span>
          <span className="font-mono text-[11px] text-success">{confidence}%</span>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            24h Forecast
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-semibold">{fmt(forecastNext24Mwh, 2)}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">MWh</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            ≈ {fmt(forecastEprw)} EPWR projected issuance
          </p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Surplus Indicator
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`font-display text-xl font-semibold ${surplus > 0 ? "text-success" : "text-destructive"}`}>
              {surplus > 0 ? "+" : ""}{fmt(surplus / 1000, 2)}
            </span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">MWh net</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Generation vs. projected demand
          </p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Settlement Congestion Risk
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`font-display text-xl font-semibold ${congestion > 60 ? "text-destructive" : congestion > 35 ? "text-amber-500" : "text-success"}`}>
              {Math.round(congestion)}
            </span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">/100</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${congestion > 60 ? "bg-destructive" : congestion > 35 ? "bg-amber-500" : "bg-success"}`}
              style={{ width: `${congestion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-background/40 p-3 lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            7-Day Generation vs. Demand · AI Synth
          </p>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekSeries} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="ai-gen" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 145)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ai-dem" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.15 220)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.7 0.15 220)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 240)" opacity={0.4} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.68 0.02 240)" }} stroke="oklch(0.28 0.02 240)" />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.68 0.02 240)" }} stroke="oklch(0.28 0.02 240)" />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.205 0.02 240)",
                    border: "1px solid oklch(0.28 0.02 240)",
                    fontSize: 11,
                  }}
                />
                <Area type="monotone" dataKey="gen" stroke="oklch(0.78 0.18 145)" fill="url(#ai-gen)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="demand" stroke="oklch(0.7 0.15 220)" fill="url(#ai-dem)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-2">
          <ImpactRow icon={<CloudRain className="h-3.5 w-3.5" />} label="Weather impact · NE" value="LOW" tone="ok" />
          <ImpactRow icon={<Droplets className="h-3.5 w-3.5" />} label="Hydro reservoir level" value="62%" tone="ok" />
          <ImpactRow icon={<Zap className="h-3.5 w-3.5" />} label="Spot price PLD signal" value="R$ 287" tone="warn" />
          <ImpactRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="Liquidity availability" value={`${liquidityIndex}/100`} tone="ok" />
          <ImpactRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Regional demand · SE peak" value="HIGH" tone="warn" />
        </div>
      </div>
    </Card>
  );
}

function ImpactRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad";
}) {
  const cls = tone === "ok" ? "text-success" : tone === "warn" ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[11px] ${cls}`}>{value}</span>
    </div>
  );
}
