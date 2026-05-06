import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { settlementTimeline } from "@/lib/mock-data";

export function SettlementTimeline() {
  return (
    <div className="space-y-0">
      {settlementTimeline.map((e, i) => {
        const last = i === settlementTimeline.length - 1;
        return (
          <div key={e.label} className="relative flex gap-4 pb-5">
            {!last && (
              <span
                className="absolute left-[11px] top-6 bottom-0 w-px bg-border"
                aria-hidden
              />
            )}
            <div className="relative z-10 mt-0.5">
              {e.state === "done" && <CheckCircle2 className="h-6 w-6 text-success" />}
              {e.state === "active" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/40">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              )}
              {e.state === "pending" && <Circle className="h-6 w-6 text-muted-foreground/40" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${e.state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                  {e.label}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{e.ts}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
