import { SETTLEMENT_STATE_FLOW, type SettlementState } from "@/lib/mock-data";
import { Check } from "lucide-react";

export function StateMachine({ current, failed }: { current: SettlementState; failed?: boolean }) {
  const idx = SETTLEMENT_STATE_FLOW.indexOf(current);
  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto">
      {SETTLEMENT_STATE_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const isFailed = failed && active;
        return (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                isFailed
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : done
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : active ? (
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current" />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-30" />
              )}
              <span className="truncate">{s}</span>
            </div>
            {i < SETTLEMENT_STATE_FLOW.length - 1 && (
              <div className={`h-px w-2 ${i < idx ? "bg-success/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
