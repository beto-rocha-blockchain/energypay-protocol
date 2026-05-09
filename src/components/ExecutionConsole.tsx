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
  buildSettlementAuthorization,
  canExecuteSettlement,
  ROLE_META,
} from "@/store/operator";
import { toast } from "sonner";

type LogLine = { ts: string; text: string; level?: "info" | "ok" | "warn" };

type Step = {
  delay: number;
  state: SettlementState;
  log: string;
  level?: "info" | "ok" | "warn";
};

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
  const [authPayload, setAuthPayload] = useState<ReturnType<typeof buildSettlementAuthorization> | null>(null);
  const startRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendLog = useOps((s) => s.appendLog);
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
    setRunning(true);
    startRef.current = Date.now();

    const settlementId = `STL-${90220 + Math.floor(Math.random() * 80)}`;
    const txHash = Array.from({ length: 64 }, () =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");
    const ledgerNum = 58921450 + Math.floor(Math.random() * 200);

    // Build the operator-bound authorization payload (consumed by backend)
    const payload = buildSettlementAuthorization(operator, {
      contractId: contract.id,
      settlementId,
      counterparty: contract.seller,
      amountBRL: amount,
      pld,
      window: contract.window,
      memo: `EPAY ${contract.id} ${settlementId}`,
      requestedAt: new Date().toISOString(),
    });
    setAuthPayload(payload);

    const signer = maskAddress(operator.wallet.publicKey);
    const roleLabel = operator.roles.map((r) => ROLE_META[r].label).join(", ") || "operator";

    const steps: Step[] = [
      { delay: 0, state: "CREATED", log: `→ session opened · operator=${operator.operatorId} · ${operator.organization}` },
      { delay: 180, state: "CREATED", log: `authorizing identity · roles=[${roleLabel}] · access=${operator.accessLevel}` },
      { delay: 360, state: "CREATED", log: `✓ settlement authority verified · permissions OK`, level: "ok" },
      { delay: 540, state: "CREATED", log: `binding execution signer · source=${signer}` },
      { delay: 720, state: "CREATED", log: `validating contract ${contract.id} against clearing pool…` },
      { delay: 940, state: "VALIDATED", log: `✓ counterparty ${contract.seller} within clearing limits`, level: "ok" },
      { delay: 1140, state: "VALIDATED", log: `pld ingested from GridRef oracle feed · R$ ${pld.toFixed(2)}/MWh` },
      { delay: 1320, state: "VALIDATED", log: `exposure calculated · ${fmtBRL(amount)} (${amount >= 0 ? "buyer" : "seller"} receives)` },
      { delay: 1540, state: "PENDING_SIGNATURE", log: `preparing settlement transaction · ${settlementId}` },
      { delay: 1760, state: "PENDING_SIGNATURE", log: `▸ awaiting operator signature · source=${operator.wallet.publicKey.slice(0, 12)}…` },
      { delay: 2020, state: "PENDING_SIGNATURE", log: `signing payload with operator keypair (ed25519) · session-bound`, level: "ok" },
      { delay: 2220, state: "BROADCASTING", log: `→ broadcasting to Stellar Testnet horizon.stellar.org`, level: "info" },
      { delay: 2520, state: "BROADCASTING", log: `awaiting confirmation · ledger window…` },
      { delay: 2980, state: "CONFIRMED", log: `✓ tx confirmed · ledger #${ledgerNum.toLocaleString("en-US")}`, level: "ok" },
      { delay: 3120, state: "CONFIRMED", log: `tx hash: ${txHash.slice(0, 16)}…${txHash.slice(-8)}` },
      { delay: 3300, state: "SETTLED", log: `✓ reconciliation closed · BRL leg cleared · signer=${signer}`, level: "ok" },
      { delay: 3450, state: "SETTLED", log: `settlement finalized · finality latency 2.4s`, level: "ok" },
    ];

    const timers: number[] = [];
    steps.forEach((s) => {
      const t = window.setTimeout(() => {
        setState(s.state);
        setLogs((l) => [...l, { ts: fmtTs(new Date()), text: s.log, level: s.level ?? "info" }]);
        updateContractState(contract.id, s.state);
        appendLog({
          contractId: contract.id,
          settlementId,
          state: s.state,
          level: (s.level ?? "info") as "info" | "ok" | "warn",
          message: s.log,
        });
      }, s.delay);
      timers.push(t);
    });
    const finish = window.setTimeout(() => {
      setTx(txHash);
      setLedger(ledgerNum);
      const lat = Date.now() - startRef.current;
      setLatency(lat);
      setRunning(false);
      setDone(true);
      const stl: Settlement = {
        id: settlementId,
        contractId: contract.id,
        counterparty: contract.seller,
        amountBRL: amount,
        pld,
        date: new Date().toISOString().slice(0, 16).replace("T", " "),
        txHash,
        ledger: ledgerNum,
        latencyMs: lat,
        window: contract.window,
        state: "SETTLED",
        status: "CONFIRMED",
      };
      recordSettlement(stl);
      toast.success("Settlement finalized", {
        description: `Signer ${signer} · Ledger #${ledgerNum}`,
      });
    }, 3550);
    timers.push(finish);

    return () => timers.forEach((t) => clearTimeout(t));
  }, [open, contract.id, contract.seller, contract.window, pld, amount, operator, authorized, appendLog, updateContractState, recordSettlement]);

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
                  running
                    ? "border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
                    : done
                    ? "border-success/40 bg-success/10 font-mono text-[10px] text-success"
                    : !authorized
                    ? "border-destructive/40 bg-destructive/10 font-mono text-[10px] text-destructive"
                    : "font-mono text-[10px]"
                }
              >
                {!authorized ? "● UNAUTHORIZED" : running ? "● SIGNING" : done ? "● FINALIZED" : "IDLE"}
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
              Execution Signer · Operator-Bound
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
              <SignerCell label="Access Level" value={operator.accessLevel.replace("_", " ")} />
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
                <span className="text-[10px]">processing…</span>
              </div>
            )}
          </div>
        </div>

        {done && tx && operator && (
          <div className="border-t border-border bg-card/40 px-5 py-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Settlement receipt
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Meta k="Contract ID" v={contract.id} />
              <Meta k="Settlement ID" v={authPayload?.settlementPayload.settlementId ?? "—"} />
              <Meta k="Counterparty" v={contract.seller} />
              <Meta k="Amount" v={fmtBRL(amount)} />
              <Meta k="Ledger #" v={ledger?.toLocaleString("en-US") ?? "—"} />
              <Meta k="Finality" v={`${((latency ?? 0) / 1000).toFixed(2)}s`} />
              <Meta k="Signer Operator" v={operator.operatorId} />
              <Meta k="Source Account" v={maskAddress(operator.wallet.publicKey)} highlight />
              <Meta k="Window" v={contract.window} />
              <Meta k="Status" v="SETTLED" highlight />
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
                  href={`https://stellar.expert/explorer/testnet/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${operator.wallet.publicKey}`}
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
