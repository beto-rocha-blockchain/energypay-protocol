type LiveStatusData = {
  network: string;
  railState: "CONNECTED" | "DEGRADED" | "OFFLINE";
  latencyMs?: number;
  updatedAt?: string;
};

type P2PLiveStatusPanelProps = {
  data?: LiveStatusData;
};

export function P2PLiveStatusPanel({
  data,
}: P2PLiveStatusPanelProps) {
  const network = data?.network ?? "Stellar Testnet";
  const railState = data?.railState ?? "CONNECTED";
  const latencyMs = data?.latencyMs ?? 2100;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          P2P Live Status
        </h3>

        <span
          className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${
            railState === "CONNECTED"
              ? "border-success/40 bg-success/10 text-success"
              : railState === "DEGRADED"
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {railState}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          Settlement rail connected to {network}.
        </p>

        <p className="font-mono">
          Finality latency ~{(latencyMs / 1000).toFixed(1)}s
        </p>
      </div>
    </div>
  );
}