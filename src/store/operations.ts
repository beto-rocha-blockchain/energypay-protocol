import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  mockContracts,
  mockSettlements,
  operationalAlerts,
  settlementQueue,
  recentSettlementFeed,
  SETTLEMENT_STATE_FLOW,
  type Contract,
  type Settlement,
  type AlertItem,
  type QueueItem,
  type FeedItem,
  type SettlementState,
  type QueuePhase,
} from "@/lib/mock-data";

/* ------------------------------------------------------------------ */
/*  Operational Log                                                    */
/* ------------------------------------------------------------------ */

export type LogLevel = "info" | "ok" | "warn" | "error";

export type ExecutionLog = {
  id: string;
  contractId: string;
  settlementId?: string;
  ts: string;            // wall-clock HH:MM:SS
  state: SettlementState;
  level: LogLevel;
  message: string;
};

/* ------------------------------------------------------------------ */
/*  Store shape                                                        */
/* ------------------------------------------------------------------ */

type Counters = { stl: number; epc: number; ledger: number; alert: number };

type OpsState = {
  contracts: Contract[];
  settlements: Settlement[];
  alerts: AlertItem[];
  queue: QueueItem[];
  feed: FeedItem[];
  logs: ExecutionLog[];
  counters: Counters;
  lastTick: number;

  /* selectors (computed) */
  getContract: (id: string) => Contract | undefined;
  getLogsFor: (contractId: string) => ExecutionLog[];

  /* mutations */
  registerContract: (input: {
    buyer: string; seller: string; volumeMWh: number; priceBRL: number;
    settlementDate: string; startDate?: string; endDate?: string;
  }) => Contract;

  appendLog: (l: Omit<ExecutionLog, "id" | "ts"> & { ts?: string }) => void;
  updateContractState: (id: string, state: SettlementState) => void;
  recordSettlement: (s: Settlement) => void;
  ackAlert: (id: string) => void;
  pushAlert: (a: Omit<AlertItem, "id" | "time">) => void;

  /* background tick — advances queue & emits operational events */
  tick: () => void;
  reset: () => void;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const now = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const pad = (n: number) => n.toString().padStart(2, "0");
const hhmm = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const rndHash = () =>
  Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const PHASE_TO_STATE: Record<QueuePhase, SettlementState> = {
  queued: "CREATED",
  validating: "VALIDATED",
  signing: "PENDING_SIGNATURE",
  broadcasting: "BROADCASTING",
  confirming: "CONFIRMED",
};
const PHASE_FLOW: QueuePhase[] = ["queued", "validating", "signing", "broadcasting", "confirming"];
const nextPhase = (p: QueuePhase): QueuePhase | "DONE" => {
  const i = PHASE_FLOW.indexOf(p);
  return i < PHASE_FLOW.length - 1 ? PHASE_FLOW[i + 1] : "DONE";
};

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

const seedLogs = (): ExecutionLog[] => {
  const sample = mockContracts.slice(0, 3);
  const out: ExecutionLog[] = [];
  sample.forEach((c, ci) => {
    const base = ["contract registered in clearing pool", "counterparty validated · KYC + collateral OK", "PLD ingested from GridRef oracle"];
    base.forEach((m, i) => {
      out.push({
        id: `LOG-${1000 + ci * 10 + i}`,
        contractId: c.id,
        ts: `09:${pad(12 + ci * 4 + i)}:0${i}`,
        state: SETTLEMENT_STATE_FLOW[Math.min(i, 1)],
        level: "info",
        message: m,
      });
    });
  });
  return out;
};

export const useOps = create<OpsState>()(
  persist(
    (set, get) => ({
      contracts: mockContracts,
      settlements: mockSettlements,
      alerts: operationalAlerts,
      queue: settlementQueue,
      feed: recentSettlementFeed,
      logs: seedLogs(),
      counters: { stl: 90220, epc: 2042, ledger: 58921500, alert: 123 },
      lastTick: 0,

      getContract: (id) => get().contracts.find((c) => c.id === id),
      getLogsFor: (cid) => get().logs.filter((l) => l.contractId === cid),

      registerContract: ({ buyer, seller, volumeMWh, priceBRL, settlementDate, startDate, endDate }) => {
        const c = get();
        const epc = c.counters.epc + 1;
        const id = `EPC-${epc}`;
        const resolvedEnd = endDate ?? settlementDate;
        const today = new Date().toISOString().slice(0, 10);
        const status: Contract["status"] =
          startDate && startDate > today ? "PENDING" : "ACTIVE";
        const contract: Contract = {
          id, buyer, seller, volumeMWh, priceBRL,
          pldBRL: priceBRL,
          settlementDate: resolvedEnd,
          startDate,
          endDate: resolvedEnd,
          status,
          state: "CREATED",
          ledger: 0,
          latencyMs: 0,
          window: "D+1 17:00 BRT",
          txHash: "0".repeat(64),
        };
        const queueItem: QueueItem = {
          id: `STL-${c.counters.stl + 1}`,
          contractId: id,
          counterparty: seller,
          amount: volumeMWh * priceBRL * 0.01, // placeholder pending PLD
          eta: "06:00",
          phase: "queued",
          priority: "normal",
          state: "CREATED",
        };
        set({
          contracts: [contract, ...c.contracts],
          queue: [...c.queue, queueItem],
          counters: { ...c.counters, epc, stl: c.counters.stl + 1 },
        });
        get().appendLog({
          contractId: id,
          state: "CREATED",
          level: "info",
          message: `${id} registered · ${buyer} ↔ ${seller} · ${volumeMWh} MWh @ R$ ${priceBRL.toFixed(2)}`,
        });
        return contract;
      },

      appendLog: ({ ts, ...rest }) => {
        const id = `LOG-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
        set((s) => ({
          logs: [...s.logs, { id, ts: ts ?? now(), ...rest }].slice(-500),
        }));
      },

      updateContractState: (id, state) => {
        set((s) => ({
          contracts: s.contracts.map((c) => (c.id === id ? { ...c, state } : c)),
        }));
      },

      recordSettlement: (settlement) => {
        set((s) => {
          const feedItem: FeedItem = {
            id: settlement.id,
            counterparty: settlement.counterparty,
            amount: settlement.amountBRL,
            ago: "just now",
          };
          return {
            settlements: [settlement, ...s.settlements],
            feed: [feedItem, ...s.feed].slice(0, 8),
            contracts: s.contracts.map((c) =>
              c.id === settlement.contractId
                ? { ...c, state: "SETTLED", status: "SETTLED", ledger: settlement.ledger, latencyMs: settlement.latencyMs, txHash: settlement.txHash, pldBRL: settlement.pld }
                : c,
            ),
            queue: s.queue.filter((q) => q.contractId !== settlement.contractId),
          };
        });
      },

      ackAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

      pushAlert: (a) => {
        set((s) => {
          const n = s.counters.alert + 1;
          return {
            alerts: [{ id: `A-${n}`, time: hhmm(), ...a }, ...s.alerts].slice(0, 12),
            counters: { ...s.counters, alert: n },
          };
        });
      },

      tick: () => {
        const s = get();
        const t = Date.now();
        if (t - s.lastTick < 4500) return;

        // advance up to 2 queue items
        const advanceIds = s.queue.slice(0, 2).map((q) => q.id);
        const newQueue: QueueItem[] = [];
        const completed: QueueItem[] = [];

        s.queue.forEach((q) => {
          if (!advanceIds.includes(q.id)) { newQueue.push(q); return; }
          const np = nextPhase(q.phase);
          if (np === "DONE") {
            completed.push(q);
          } else {
            newQueue.push({ ...q, phase: np, state: PHASE_TO_STATE[np] });
            get().appendLog({
              contractId: q.contractId,
              settlementId: q.id,
              state: PHASE_TO_STATE[np],
              level: np === "broadcasting" ? "info" : np === "confirming" ? "ok" : "info",
              message:
                np === "validating" ? `validating ${q.contractId} · counterparty limits OK` :
                np === "signing" ? `signing payload · EPWR keypair (ed25519)` :
                np === "broadcasting" ? `broadcasting ${q.id} → Stellar Testnet horizon` :
                `awaiting confirmation · ledger window…`,
            });
          }
        });

        // finalize completed → record settlement
        completed.forEach((q) => {
          const c = s.contracts.find((cc) => cc.id === q.contractId);
          if (!c) return;
          const ledger = s.counters.ledger + Math.floor(Math.random() * 30);
          const stl: Settlement = {
            id: q.id,
            contractId: q.contractId,
            counterparty: q.counterparty,
            amountBRL: q.amount,
            pld: c.pldBRL,
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            txHash: rndHash(),
            ledger,
            latencyMs: 1800 + Math.floor(Math.random() * 1200),
            window: c.window,
            state: "SETTLED",
            status: "CONFIRMED",
          };
          get().recordSettlement(stl);
          get().appendLog({
            contractId: q.contractId,
            settlementId: q.id,
            state: "SETTLED",
            level: "ok",
            message: `✓ ${q.id} finalized · ledger #${ledger.toLocaleString("en-US")} · BRL leg cleared`,
          });
          set((cur) => ({ counters: { ...cur.counters, ledger: ledger + 1 } }));
        });

        // age feed labels
        const feed = s.feed.map((f) => ({
          ...f,
          ago: f.ago === "just now" ? "30s ago" : f.ago,
        }));

        // occasionally emit an operational alert (~1 in 6 ticks)
        if (Math.random() < 0.16) {
          const candidates: Array<Omit<AlertItem, "id" | "time">> = [
            { level: "warn", title: "Counterparty ack delay", detail: "ack pending > 60s on active settlement" },
            { level: "info", title: "Reconciliation queue normalising", detail: "pending items decreasing" },
            { level: "warn", title: "Oracle PLD lag", detail: "GridRef feed drift 4.1s vs reference clock" },
            { level: "info", title: "New cycle window opened", detail: "D+1 17:00 BRT clearing window active" },
          ];
          get().pushAlert(candidates[Math.floor(Math.random() * candidates.length)]);
        }

        set({ queue: newQueue, feed, lastTick: t });
      },

      reset: () =>
        set({
          contracts: mockContracts,
          settlements: mockSettlements,
          alerts: operationalAlerts,
          queue: settlementQueue,
          feed: recentSettlementFeed,
          logs: seedLogs(),
          counters: { stl: 90220, epc: 2042, ledger: 58921500, alert: 123 },
          lastTick: 0,
        }),
    }),
    {
      name: "energypay.ops.v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      partialize: (s) => ({
        contracts: s.contracts,
        settlements: s.settlements,
        alerts: s.alerts,
        queue: s.queue,
        feed: s.feed,
        logs: s.logs,
        counters: s.counters,
      }),
    },
  ),
);

/* ------------------------------------------------------------------ */
/*  Background ticker — drives institutional "live" feeling            */
/* ------------------------------------------------------------------ */

let tickerStarted = false;
export function startOpsTicker() {
  if (tickerStarted || typeof window === "undefined") return;
  tickerStarted = true;
  setInterval(() => useOps.getState().tick(), 5000);
}
