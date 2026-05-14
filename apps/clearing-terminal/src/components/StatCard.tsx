import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, sub, icon, trend,
}: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; trend?: "up" | "down" | "flat" }) {
  return (
    <Card className="relative overflow-hidden border-border bg-[image:var(--gradient-card)] p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {sub && (
            <p className={cn("text-xs font-mono",
              trend === "up" && "text-success",
              trend === "down" && "text-destructive",
              !trend && "text-muted-foreground")}>{sub}</p>
          )}
        </div>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </div>
      <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
    </Card>
  );
}
