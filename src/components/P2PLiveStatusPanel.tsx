import { CheckCircle2, Loader2, AlertTriangle, ExternalLink, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stellarExpertTx } from "@/lib/stellar";
import type { P2PTransferState } from "@/store/p2p";

export type LiveStatusPhase = "SUBMITTED" | "CONFIRMED" | "SETTLED";

export type LiveStatusData = {
  phase: LiveStatusPhase | null;
  state: P2PTransferState;
  txHash: string | null;
  ledger: number | null;
  finalityMs: number | null;
  explorerLink: string | null;
  startedAt: number | null;
  errorMessage: string | null;
};

const ORDER: LiveStatusPhase[] = ["SUBMITTED", "CONFIRMED", "SETTLED"];

const PHASE_LABEL: Record<LiveStatusPhase, string> = {
  SUBMITTED: "Submitted to backend",
  CONFIRMED: "Confirmed on Horizon",
  SETTLED: "Settled · Stellar finality",
};

const PHASE_HINT: Record<LiveStatusPhase, string> = {
  SUBMITTED: "Backend signing in custody · broadcasting to Stellar Testnet",
  CONFIRMED: "Tx accepted into ledger · awaiting finality",
  SETTLED: "Direct settlement rail closed · receipt issued",
};

const phaseRank = (p: LiveStatusPhase | null) =>
  p === null ? -1 : ORDER.indexOf(p);

export function P2PLiveStatusPanel({ data }: { data: LiveStatusData }) {
  const failed = data.state === "FAILED";
  const idle = data.phase === null && !failed;
  const currentRank = phaseRank(data.phase);

  return (
    <Card className="border-border bg-card p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" /> Live transfer status · backend feed
        </p>
        <Badge
          variant="outline"
          className={
            failed
              ? "border-destructive/40 bg-destructive/10 font-mono text-[10px] text-destructive"
              : data.state === "FINALIZED"
              ? "border-success/40 bg-success/10 font-mono text-[10px] text-success"
              : idle
              ? "font-mono text-[10px]"
              : "border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
          }
        >
          {failed ? "● FAILED" : idle ? "IDLE" : `● ${data.state}`}
        </Badge>
      </div>

      <div className="space-y-3 px-5 py-4">
        {failed && data.errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{data.errorMessage}</span>
          </div>
        )}

        <ol className="space-y-2.5">
          {ORDER.map((phase, idx) => {
            const reached = !failed && currentRank >= idx;
            const active = !failed && currentRank === idx && data.state !== "FINALIZED";
            const done = !failed && (currentRank > idx || data.state === "FINALIZED");
            return (
              <li
                key={phase}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 ${
                  done
                    ? "border-success/30 bg-success/5"
                    : active
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background/30"
                }`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-muted-foreground/40" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-mono text-[11px] uppercase tracking-widest ${
                      done ? "text-success" : active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {PHASE_LABEL[phase]}
                  </p>
                  <p className="text-[11px] text-foreground/75">{PHASE_HINT[phase]}</p>
                  {phase === "CONFIRMED" && reached && data.txHash && (
                    <code className="mt-1 block break-all rounded bg-background/60 p-1.5 font-mono text-[10px] text-foreground/85">
                      tx · {data.txHash}
                    </code>
                  )}
                  {phase === "CONFIRMED" && reached && data.ledger !== null && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      ledger #{data.ledger.toLocaleString("en-US")}
                    </p>
                  )}
                  {phase === "SETTLED" && done && data.finalityMs !== null && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      finality · {(data.finalityMs / 1000).toFixed(2)}s
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {data.txHash && (data.explorerLink || true) && (
          <a
            href={data.explorerLink || stellarExpertTx(data.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent hover:underline"
          >
            View on Stellar Expert <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {idle && (
          <p className="font-mono text-[11px] text-muted-foreground">
            $ awaiting settlement authorization · status feed will stream phases as the backend confirms.
          </p>
        )}
      </div>
    </Card>
  );
}
