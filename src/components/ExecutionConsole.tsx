import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Terminal, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { StateMachine } from "@/components/StateMachine";
import { type SettlementState, type Contract, type Settlement } from "@/lib/mock-data";
import { useOps } from "@/store/operations";
import {
  useOperator,
  maskAddress,
  canExecuteSettlement,
  ROLE_META,
} from "@/store/operator";
import { apiExecuteSettlement, type SettlementResult } from "@/lib/api";
import { stellarExpertTx, stellarExpertAccount } from "@/lib/stellar";
import { toast } from "sonner";

type LogLine = { ts: string; text: string; level?: "info" | "ok" | "warn" };

const fmtTs = (d: Date) =>
  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function ExecutionConsole({
  open,
  onOpenChange,
  contract,
  pld,
  amount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract: Contract;
  pld: number;
  amount: number;
}) {
  const operator = useOperator((s) => s.operator);
  const authorized = canExecuteSettlement(operator);

  const [logs, setLogs] = useState<LogLine[]>([]);
  const [state, setState] = useState<SettlementState>("CREATED");
  const [tx, setTx] = useState<string | null>(null);
  const [ledger, setLedger] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const startRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendOpsLog = useOps((s) => s.appendLog);
  const updateContractState = useOps((s) => s.updateContractState);
  const recordSettlement = useOps((s) => s.recordSettlement);

  useEffect(() => {
    if (!open) return;
    if (!operator || !authorized) {
      setLogs([
        {
          ts: fmtTs(new Date()),
          text: "✗ settlement authorization rejected · no operational identity bound to session",
          level: "warn",
        },
      ]);
      setRunning(false);
      setDone(false);
      return;
    }

    setLogs([]);
    setState("CREATED");
    setTx(null);
    setLedger(null);
    setLatency(null);
    setDone(false);
    setFailed(null);
    setResult(null);
    setRunning(true);
    startRef.current = Date.now();

    const settlementId = `STL-${90220 + Math.floor(Math.random() * 80)}`;
    const signer = maskAddress(operator.wallet.publicKey);
    const roleLabel = operator.roles.map((r) => ROLE_META[r].label).join(", ") || "operator";

    let cancelled = false;
    const log = (s: SettlementState, text: string, level: "info" | "ok" | "warn" = "info") => {
      if (cancelled) return;
      setState(s);
      setLogs((l) => [...l, { ts: fmtTs(new Date()), text, level }]);
      updateContractState(contract.id, s);
      appendOpsLog({ contractId: contract.id, settlementId, state: s, level, message: text });
    };
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      log("CREATED", `→ session opened · operator=${operator.operatorId} · ${operator.organization}`);
      await wait(160);
      log("CREATED", `authorizing identity · roles=[${roleLabel}] · access=${operator.accessLevel}`);
      await wait(160);
      log("CREATED", `binding execution signer · source=${signer}`, "ok");
      await wait(180);
      log("VALIDATED", `pld ingested from GridRef oracle feed · R$ ${pld.toFixed(2)}/MWh`);
      await wait(160);
      log("VALIDATED", `exposure calculated · ${fmtBRL(amount)} (${amount >= 0 ? "buyer" : "seller"} receives)`);
      await wait(180);
      log("PENDING_SIGNATURE", `▸ requesting backend settlement execution · ${settlementId}`);
      log("BROADCASTING", `→ POST /api/settlements/execute · backend signs & broadcasts`, "info");

      try {
        const res = await apiExecuteSettlement({
          contract_id: contract.id,
          settlement_id: settlementId,
          counterparty: contract.seller,
          amount_brl: amount,
          pld,
          window: contract.window,
          memo: `EPAY ${contract.id} ${settlementId}`,
        });
        if (cancelled) return;

        if (res.status === "FAILED") {
          const msg = res.error || "Backend reported settlement failure";
          log("FAILED", `✗ ${msg}`, "warn");
          setFailed(msg);
          setRunning(false);
          toast.error("Settlement failed", { description: msg });
          return;
        }

        log("CONFIRMED", `✓ tx confirmed · ledger #${res.ledger.toLocaleString("en-US")}`, "ok");
        log("CONFIRMED", `tx hash: ${res.tx_hash}`);
        await wait(140);
        log("SETTLED", `✓ reconciliation closed · BRL leg cleared · signer=${signer}`, "ok");

        const lat = res.finality_ms ?? Date.now() - startRef.current;
        log("SETTLED", `settlement finalized · finality latency ${(lat / 1000).toFixed(2)}s`, "ok");

        setTx(res.tx_hash);
        setLedger(res.ledger);
        setLatency(lat);
        setResult(res);
        setRunning(false);
        setDone(true);

        const stl: Settlement = {
          id: res.settlement_id ?? settlementId,
          contractId: contract.id,
          counterparty: contract.seller,
          amountBRL: amount,
          pld,
          date: new Date().toISOString().slice(0, 16).replace("T", " "),
          txHash: res.tx_hash,
          ledger: res.ledger,
          latencyMs: lat,
          window: contract.window,
          state: "SETTLED",
          status: "CONFIRMED",
        };
        recordSettlement(stl);
        toast.success("Settlement finalized", {
          description: `Ledger #${res.ledger} · ${(lat / 1000).toFixed(2)}s`,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message || "Backend submission failed";
        log("FAILED", `✗ ${msg}`, "warn");
        setFailed(msg);
        setRunning(false);
        toast.error("Settlement broadcast failed", { description: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, contract.id, contract.seller, contract.window, pld, amount, operator, authorized, appendOpsLog, updateContractState, recordSettlement]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const sourceShort = operator ? maskAddress(operator.wallet.publicKey) : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-background p-0 sm:max-w-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <SheetHeader className="space-y-1 text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="font-display flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4 text-primary" />
                Settlement Authorization Console
              </SheetTitle>
              <Badge
                variant="outline"
                className={
                  failed
                    ? "border-destructive/40 bg-destructive/10 font-mono text-[10px] text-destructive"
                    : running
                    ? "border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
                    : done
                    ? "border-success/40 bg-success/10 font-mono text-[10px] text-success"
                    : !authorized
                    ? "border-destructive/40 bg-destructive/10 font-mono text-[10px] text-destructive"
                    : "font-mono text-[10px]"
                }
              >
                {!authorized ? "● UNAUTHORIZED" : failed ? "● FAILED" : running ? "● SIGNING" : done ? "● FINALIZED" : "IDLE"}
              </Badge>
            </div>
            <SheetDescription className="font-mono text-[11px] uppercase tracking-widest">
              {contract.id} · {contract.buyer} ↔ {contract.seller} · Stellar Testnet
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Operator-bound signer panel */}
        <div className="border-b border-border bg-card/40 px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-success" />
              Execution Signer · Backend Custody
            </p>
            {operator && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {operator.operatorId}
              </span>
            )}
          </div>
          {operator ? (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <SignerCell label="Source Public Key" value={operator.wallet.publicKey} mono truncate />
              <SignerCell label="Settlement Authority" value={operator.organization} />
              <SignerCell
                label="Active Roles"
                value={operator.roles.map((r) => ROLE_META[r].label).join(" · ") || "—"}
              />
              <SignerCell label="Wallet Status" value={`${operator.wallet.status}${operator.funded ? " · FUNDED" : ""}`} />
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[11px] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              No operational identity bound to session
            </div>
          )}
        </div>

        <div className="border-b border-border px-5 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            State machine
          </p>
          <StateMachine current={state} />
        </div>

        <div className="px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Execution log · stdout
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <KeyRound className="h-3 w-3" /> signer {sourceShort}
            </p>
          </div>
          <div
            ref={scrollRef}
            className="h-[280px] overflow-y-auto rounded-md border border-border bg-[oklch(0.13_0.018_240)] p-3 font-mono text-[11px] leading-relaxed"
          >
            {logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-muted-foreground/60">[{l.ts}]</span>
                <span
                  className={
                    l.level === "ok"
                      ? "text-success"
                      : l.level === "warn"
                      ? "text-warning"
                      : "text-foreground/85"
                  }
                >
                  {l.text}
                </span>
              </div>
            ))}
            {running && (
              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-1.5 animate-pulse bg-primary" />
                <span className="text-[10px]">awaiting backend confirmation…</span>
              </div>
            )}
          </div>
        </div>

        {done && tx && operator && result && (
          <div className="border-t border-border bg-card/40 px-5 py-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Settlement receipt · backend
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Meta k="Contract ID" v={contract.id} />
              <Meta k="Settlement ID" v={result.settlement_id} />
              <Meta k="Counterparty" v={contract.seller} />
              <Meta k="Amount" v={fmtBRL(amount)} />
              <Meta k="Ledger #" v={ledger?.toLocaleString("en-US") ?? "—"} />
              <Meta k="Finality" v={`${((latency ?? 0) / 1000).toFixed(2)}s`} />
              <Meta k="Signer Operator" v={operator.operatorId} />
              <Meta k="Source Account" v={maskAddress(result.source_public_key ?? operator.wallet.publicKey)} highlight />
              <Meta k="Window" v={contract.window} />
              <Meta k="Status" v={result.status} highlight />
            </dl>
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Tx hash
              </p>
              <div className="mt-1 flex items-start gap-2">
                <code className="flex-1 break-all rounded bg-background/60 p-2 font-mono text-[11px]">
                  {tx}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(tx);
                    toast.success("Tx hash copied");
                  }}
                  aria-label="Copy tx hash"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <a
                  href={stellarExpertTx(tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  View transaction on Stellar Expert <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={stellarExpertAccount(result.source_public_key ?? operator.wallet.publicKey)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent"
                >
                  Source account audit <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {failed && (
          <div className="border-t border-border bg-destructive/5 px-5 py-4">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Settlement broadcast failed
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{failed}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              Verify backend connectivity ({"http://localhost:3000"}) and Horizon network status, then retry.
            </p>
          </div>
        )}

        {!authorized && (
          <div className="border-t border-border bg-destructive/5 px-5 py-4">
            <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Settlement authorization unavailable
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              The current session has no provisioned settlement authority. Sign in with an
              operational identity holding <span className="text-foreground">settlements.execute</span>{" "}
              to authorize this transaction.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SignerCell({
  label, value, mono, truncate,
}: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[11px] ${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Meta({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
      <dd className={`font-mono ${highlight ? "text-success" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
