import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LifecycleState, Severity } from "@/lib/terminology";

/* -------- StatusDot -------- */
export function StatusDot({
  tone = "ok",
  pulse = true,
  className,
}: {
  tone?: "ok" | "warn" | "bad" | "muted" | "info";
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "ok" ? "bg-success" :
    tone === "warn" ? "bg-warning" :
    tone === "bad" ? "bg-destructive" :
    tone === "info" ? "bg-primary" :
    "bg-muted-foreground/50";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        color,
        pulse && tone !== "muted" && "animate-pulse",
        className,
      )}
    />
  );
}

/* -------- SeverityBadge -------- */
export function SeverityBadge({
  level,
  label,
  className,
}: {
  level: "INFO" | "WARN" | "CRITICAL" | "OK" | "PENDING";
  label?: string;
  className?: string;
}) {
  const tone =
    level === "CRITICAL" ? "border-destructive/50 text-destructive bg-destructive/5" :
    level === "WARN"     ? "border-warning/50 text-warning bg-warning/5" :
    level === "OK"       ? "border-success/50 text-success bg-success/5" :
    level === "PENDING"  ? "border-primary/50 text-primary bg-primary/5" :
                            "border-border text-muted-foreground";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-[1px] font-mono text-[9px] tracking-widest uppercase",
      tone, className,
    )}>
      {label ?? level}
    </span>
  );
}

/* -------- KpiTile -------- */
export function KpiTile({
  label,
  value,
  sub,
  tone = "default",
  spark,
  unit,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "ok" | "warn" | "bad" | "primary";
  spark?: ReactNode;
  unit?: string;
}) {
  const valueColor =
    tone === "ok" ? "text-success" :
    tone === "warn" ? "text-warning" :
    tone === "bad" ? "text-destructive" :
    tone === "primary" ? "text-primary" :
    "text-foreground";
  return (
    <div className="panel relative overflow-hidden p-3">
      <div className="flex items-center justify-between">
        <span className="label-op">{label}</span>
        <StatusDot tone={tone === "default" ? "info" : tone === "primary" ? "info" : tone} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="leading-none">
          <span className={cn("kpi-num text-2xl font-semibold", valueColor)}>{value}</span>
          {unit && <span className="ml-1 font-mono text-[10px] uppercase text-muted-foreground">{unit}</span>}
        </div>
        {spark && <div className="h-8 w-20 opacity-80">{spark}</div>}
      </div>
      {sub && <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* -------- KpiStrip wrapper -------- */
export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border/70 md:grid-cols-3 xl:grid-cols-6">
      {children}
    </div>
  );
}

/* -------- Panel shell -------- */
export function Panel({
  title,
  subtitle,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      <header className="panel-header">
        <div className="flex flex-col">
          <span className="label-op">{subtitle ?? "Operational Module"}</span>
          <h2 className="font-display text-[13px] font-semibold tracking-tight">{title}</h2>
        </div>
        {right}
      </header>
      <div className={cn("flex-1 p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/* -------- Sparkline (mini polyline, dependency-free) -------- */
export function Sparkline({
  values,
  color = "currentColor",
  height = 28,
  width = 80,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1 || 1);
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <polyline fill="none" stroke={color} strokeWidth={1.25} points={points} />
    </svg>
  );
}

/* -------- Severity dot for tables -------- */
export function CellNum({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok" ? "text-success" :
    tone === "warn" ? "text-warning" :
    tone === "bad" ? "text-destructive" :
    "";
  return <span className={cn("font-mono tabular text-[11.5px]", color)}>{children}</span>;
}
