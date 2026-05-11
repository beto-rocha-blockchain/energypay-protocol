import { useEffect, useState } from "react";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { StatusDot } from "@/components/ops/primitives";
import { useOperator } from "@/store/operator";

/**
 * Persistent operational status rail rendered in the app header.
 * Live Horizon latency · rail state · operator · UTC clock.
 */
export function StatusRail() {
  const { railState, health } = useSettlementRail();
  const operator = useOperator((s) => s.operator);
  const [utc, setUtc] = useState(() => new Date().toUTCString().slice(17, 25));

  useEffect(() => {
    const id = window.setInterval(() => setUtc(new Date().toUTCString().slice(17, 25)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tone =
    railState === "CONNECTED" ? "ok" : railState === "DEGRADED" ? "warn" : railState === "OFFLINE" ? "bad" : "muted";
  const horizonMs = health?.horizon.latency_ms ?? 0;
  const backendMs = health?.backend.latency_ms ?? 0;

  return (
    <div className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:flex">
      <span className="flex items-center gap-1.5">
        <StatusDot tone={tone} />
        <span className={tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : ""}>
          Rail · {railState}
        </span>
      </span>
      <span className="opacity-60">|</span>
      <span>Horizon {horizonMs} ms</span>
      <span className="opacity-60">|</span>
      <span>Backend {backendMs} ms</span>
      <span className="opacity-60">|</span>
      <span>Op · {operator?.email?.split("@")[0] ?? "system"}</span>
      <span className="opacity-60">|</span>
      <span className="text-foreground/80">{utc} UTC</span>
    </div>
  );
}
