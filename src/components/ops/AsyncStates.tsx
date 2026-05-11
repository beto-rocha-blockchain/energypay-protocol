/**
 * Reusable operational async-state primitives.
 * Use across every data-driven panel for consistent loading / empty /
 * degraded / retry behavior.
 */
import { AlertTriangle, RefreshCcw, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "./primitives";
import type { ReactNode } from "react";

export function LoadingRows({
  count = 6,
  cols = 5,
  className,
}: {
  count?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("animate-pulse divide-y divide-border/60", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid items-center gap-3 px-3 py-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-2.5 rounded-sm bg-border/70"
              style={{ opacity: 0.4 + (((i + c) * 17) % 50) / 100 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = "No operational records",
  hint = "This module has nothing to display in the current window.",
  icon,
  action,
  className,
}: {
  title?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="rounded-sm border border-border bg-card p-2 text-muted-foreground">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      <p className="font-display text-[13px] font-medium text-foreground">{title}</p>
      <p className="max-w-md text-[11.5px] text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

export function DegradedBanner({
  reason,
  asOf,
  onRetry,
  className,
}: {
  reason: string;
  asOf?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/5 px-3 py-1.5",
      className,
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        <span className="label-op text-warning">Degraded · </span>
        <span className="font-mono text-[10.5px] text-foreground/85">{reason}</span>
        {asOf && (
          <span className="font-mono text-[10px] text-muted-foreground">· last update {asOf}</span>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-sm border border-warning/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-warning hover:bg-warning/10"
        >
          <RefreshCcw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}

export function RetryInline({
  message = "Failed to load",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-6 text-[11.5px]">
      <StatusDot tone="bad" pulse={false} />
      <span className="text-muted-foreground">{message}.</span>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest hover:bg-card"
      >
        <RefreshCcw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}
