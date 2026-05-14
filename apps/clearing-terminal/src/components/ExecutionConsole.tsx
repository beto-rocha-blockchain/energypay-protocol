import { useOps } from "@/store/operations";
import { executeSettlement } from "@/services/settlementApi";
import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Terminal } from "lucide-react";
import { StateMachine } from "@/components/StateMachine";
import {
  type SettlementState,
  type Contract,
  type Settlement,
} from "@/lib/mock-data";
import { toast } from "sonner";

type LogLine = {
  ts: string;
  text: string;
  level?: "info" | "ok" | "warn";
};

type Step = {
  delay: number;
  state: SettlementState;
  log: string;
  level?: "info" | "ok" | "warn";
};

const fmtTs = (d: Date) =>
  `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

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
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [state, setState] =
    useState<SettlementState>("CREATED");

  const [tx, setTx] = useState<string | null>(null);

  const [ledger, setLedger] =
    useState<number | null>(null);

  const [latency, setLatency] =
    useState<number | null>(null);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const startRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendLog = useOps((s) => s.appendLog);
  const updateContractState = useOps(
    (s) => s.updateContractState
  );
  const recordSettlement = useOps(
    (s) => s.recordSettlement
  );

  useEffect(() => {
    if (!open) return;

    setLogs([]);
    setState("CREATED");
    setTx(null);
    setLedger(null);
    setLatency(null);
    setDone(false);
    setRunning(true);

    startRef.current = Date.now();

    const settlementId = `STL-${
      90220 + Math.floor(Math.random() * 80)
    }`;

    // TEMP until backend integration is completed
    let txHash = "pending";
    let ledgerNum = 0;

    const steps: Step[] = [
      {
        delay: 0,
        state: "CREATED",
        log: `→ session opened · operator=clearing-desk-01 · contract=${contract.id}`,
      },
      {
        delay: 320,
        state: "CREATED",
        log: `validating contract ${contract.id}…`,
      },
      {
        delay: 640,
        state: "VALIDATED",
        log: `✓ counterparty ${contract.seller} within clearing limits`,
        level: "ok",
      },
      {
        delay: 880,
        state: "VALIDATED",
        log: `pld ingested from CCEE oracle feed · R$ ${pld.toFixed(
          2
        )}/MWh`,
      },
      {
        delay: 1100,
        state: "VALIDATED",
        log: `exposure calculated · ${fmtBRL(amount)} (${
          amount >= 0 ? "buyer" : "seller"
        } receives)`,
      },
      {
        delay: 1380,
        state: "PENDING_SIGNATURE",
        log: `preparing settlement transaction · ${settlementId}`,
      },
      {
        delay: 1700,
        state: "PENDING_SIGNATURE",
        log: `signing payload with EPWR keypair (ed25519)…`,
      },
      {
        delay: 2050,
        state: "BROADCASTING",
        log: `→ broadcasting to Stellar Testnet horizon.stellar.org`,
      },
      {
        delay: 2400,
        state: "BROADCASTING",
        log: `awaiting confirmation · ledger window…`,
      },
      {
        delay: 2900,
        state: "CONFIRMED",
        log: `✓ tx submitted to Stellar network`,
        level: "ok",
      },
      {
        delay: 3050,
        state: "CONFIRMED",
        log: `awaiting tx hash confirmation...`,
      },
      {
        delay: 3250,
        state: "SETTLED",
        log: `✓ reconciliation closed · BRL leg cleared`,
        level: "ok",
      },
      {
        delay: 3400,
        state: "SETTLED",
        log: `settlement finalized · finality latency 2.4s`,
        level: "ok",
      },
    ];

    const timers: number[] = [];

    steps.forEach((s) => {
      const t = window.setTimeout(() => {
        setState(s.state);

        setLogs((l) => [
          ...l,
          {
            ts: fmtTs(new Date()),
            text: s.log,
            level: s.level ?? "info",
          },
        ]);

        updateContractState(contract.id, s.state);

        appendLog({
          contractId: contract.id,
          settlementId,
          state: s.state,
          level: (s.level ?? "info") as
            | "info"
            | "ok"
            | "warn",
          message: s.log,
        });
      }, s.delay);

      timers.push(t);
    });

    const finish = window.setTimeout(async () => {
      const result = await executeSettlement();
    
      txHash = result.txHash;
      ledgerNum = result.ledger;
      
      setTx(txHash);
      setLedger(ledgerNum);

      setLogs((l) => [
        ...l,
        {
          ts: fmtTs(new Date()),
          text: `✓ tx confirmed · ledger #${ledgerNum.toLocaleString("en-US")}`,
          level: "ok",
        },
        {
          ts: fmtTs(new Date()),
          text: `tx hash: ${txHash}`,
          level: "info",
        },
      ]);

      const lat = Date.now() - startRef.current;

      setLatency(lat);
      setRunning(false);
      setDone(true);

      const stl: Settlement = {
        id: settlementId,
        contractId: contract.id,
        counterparty: contract.seller,
        amountBRL: amount,
        pld: pld,
        date: new Date()
          .toISOString()
          .slice(0, 16)
          .replace("T", " "),
        txHash,
        ledger: ledgerNum,
        latencyMs: lat,
        window: contract.window,
        state: "SETTLED",
        status: "CONFIRMED",
      };

      recordSettlement(stl);

      toast.success("Settlement finalized", {
        description: `Ledger #${ledgerNum}`,
      });
    }, 3500);

    timers.push(finish);

    return () =>
      timers.forEach((t) => clearTimeout(t));
  }, [
    open,
    contract.id,
    contract.seller,
    contract.window,
    pld,
    amount,
    appendLog,
    updateContractState,
    recordSettlement,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

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
                Settlement Execution Console
              </SheetTitle>

              <Badge
                variant="outline"
                className={
                  running
                    ? "border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
                    : done
                    ? "border-success/40 bg-success/10 font-mono text-[10px] text-success"
                    : "font-mono text-[10px]"
                }
              >
                {running
                  ? "● RUNNING"
                  : done
                  ? "● FINALIZED"
                  : "IDLE"}
              </Badge>
            </div>

            <SheetDescription className="font-mono text-[11px] uppercase tracking-widest">
              {contract.id} · {contract.buyer} ↔{" "}
              {contract.seller} · Stellar Testnet
            </SheetDescription>
          </SheetHeader>
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

            <p className="font-mono text-[10px] text-muted-foreground">
              {logs.length} lines
            </p>
          </div>

          <div
            ref={scrollRef}
            className="h-[280px] overflow-y-auto rounded-md border border-border bg-[oklch(0.13_0.018_240)] p-3 font-mono text-[11px] leading-relaxed"
          >
            {logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-muted-foreground/60">
                  [{l.ts}]
                </span>

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

                <span className="text-[10px]">
                  processing…
                </span>
              </div>
            )}
          </div>
        </div>

        {done && tx && (
          <div className="border-t border-border bg-card/40 px-5 py-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Settlement receipt
            </p>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Meta k="Contract ID" v={contract.id} />

              <Meta
                k="Settlement ID"
                v={`STL-${
                  90220 + (ledger ? ledger % 80 : 0)
                }`}
              />

              <Meta
                k="Counterparty"
                v={contract.seller}
              />

              <Meta
                k="Amount"
                v={fmtBRL(amount)}
              />

              <Meta
                k="Ledger #"
                v={
                  ledger?.toLocaleString("en-US") ??
                  "—"
                }
              />

              <Meta
                k="Finality"
                v={`${(
                  (latency ?? 0) / 1000
                ).toFixed(2)}s`}
              />

              <Meta
                k="Window"
                v={contract.window}
              />

              <Meta
                k="Status"
                v="SETTLED"
                highlight
              />
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

            <div className="mt-4 flex items-center justify-between">
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${tx}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                View on Stellar Expert{" "}
                <ExternalLink className="h-3 w-3" />
              </a>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({
  k,
  v,
  highlight,
}: {
  k: string;
  v: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {k}
      </dt>

      <dd
        className={`font-mono ${
          highlight
            ? "text-success"
            : "text-foreground"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}