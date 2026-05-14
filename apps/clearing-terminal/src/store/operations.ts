import { executeSettlement } from "@/services/settlementApi.ts";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  mockContracts,
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
/* Operational Log */
/* ------------------------------------------------------------------ */

export type LogLevel =
  | "info"
  | "ok"
  | "warn"
  | "error";

export type ExecutionLog = {
  id: string;
  contractId: string;
  settlementId?: string;
  ts: string;
  state: SettlementState;
  level: LogLevel;
  message: string;
};

/* ------------------------------------------------------------------ */
/* Store shape */
/* ------------------------------------------------------------------ */

type Counters = {
  stl: number;
  epc: number;
  ledger: number;
  alert: number;
};

type OpsState = {
  contracts: Contract[];
  settlements: Settlement[];

  alerts: AlertItem[];
  queue: QueueItem[];
  feed: FeedItem[];
  logs: ExecutionLog[];

  counters: Counters;
  lastTick: number;

  getContract: (
    id: string
  ) => Contract | undefined;

  getLogsFor: (
    contractId: string
  ) => ExecutionLog[];

  registerContract: (input: {
    buyer: string;
    seller: string;
    volumeMWh: number;
    priceBRL: number;
    settlementDate: string;
  }) => Contract;

  appendLog: (
    l: Omit<
      ExecutionLog,
      "id" | "ts"
    > & {
      ts?: string;
    }
  ) => void;

  updateContractState: (
    id: string,
    state: SettlementState
  ) => void;

  recordSettlement: (
    s: Settlement
  ) => void;

  ackAlert: (
    id: string
  ) => void;

  pushAlert: (
    a: Omit<
      AlertItem,
      "id" | "time"
    >
  ) => void;

  tick: () => void;
  reset: () => void;
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const pad = (n: number) =>
  n.toString().padStart(2, "0");

const now = () => {
  const d = new Date();

  return `${pad(
    d.getHours()
  )}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};

const hhmm = () => {
  const d = new Date();

  return `${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const PHASE_TO_STATE: Record<
  QueuePhase,
  SettlementState
> = {
  queued: "CREATED",
  validating: "VALIDATED",
  signing: "PENDING_SIGNATURE",
  broadcasting: "BROADCASTING",
  confirming: "CONFIRMED",
};

const PHASE_FLOW: QueuePhase[] = [
  "queued",
  "validating",
  "signing",
  "broadcasting",
  "confirming",
];

const nextPhase = (
  p: QueuePhase
): QueuePhase | "DONE" => {
  const i = PHASE_FLOW.indexOf(p);

  return i <
    PHASE_FLOW.length - 1
    ? PHASE_FLOW[i + 1]
    : "DONE";
};

/* ------------------------------------------------------------------ */
/* Seed */
/* ------------------------------------------------------------------ */

const seedLogs = (): ExecutionLog[] => [];

/* ------------------------------------------------------------------ */
/* Store */
/* ------------------------------------------------------------------ */

export const useOps =
  create<OpsState>()(
    persist(
      (set, get) => ({
          contracts: mockContracts,
          settlements: [],
        alerts: operationalAlerts,

        queue:
          settlementQueue,

        feed:
          recentSettlementFeed,

        logs: seedLogs(),

        counters: {
          stl: 90220,
          epc: 2042,
          ledger: 58921500,
          alert: 123,
        },

        lastTick: 0,

        getContract: (
          id
        ) =>
          get().contracts.find(
            (c) => c.id === id
          ),

        getLogsFor: (cid) =>
          get().logs.filter(
            (l) =>
              l.contractId === cid
          ),

        registerContract: ({
          buyer,
          seller,
          volumeMWh,
          priceBRL,
          settlementDate,
        }) => {
          const c = get();

          const epc =
            c.counters.epc + 1;

          const id = `EPC-${epc}`;

          const contract: Contract =
            {
              id,
              buyer,
              seller,
              volumeMWh,
              priceBRL,

              pldBRL: priceBRL,

              settlementDate,

              status: "ACTIVE",

              state: "CREATED",

              ledger: 0,

              latencyMs: 0,

              window:
                "D+1 17:00 BRT",

              txHash:
                "0".repeat(64),
            };

          const queueItem: QueueItem =
            {
              id: `STL-${
                c.counters.stl + 1
              }`,

              contractId: id,

              counterparty:
                seller,

              amount:
                volumeMWh *
                priceBRL *
                0.01,

              eta: "06:00",

              phase: "queued",

              priority: "normal",

              state: "CREATED",
            };

          set({
            contracts: [
              contract,
              ...c.contracts,
            ],

            queue: [
              ...c.queue,
              queueItem,
            ],

            counters: {
              ...c.counters,
              epc,
              stl:
                c.counters.stl +
                1,
            },
          });

          return contract;
        },

        appendLog: ({
          ts,
          ...rest
        }) => {
          const id = `LOG-${Date.now()}`;

          set((s) => ({
            logs: [
              ...s.logs,
              {
                id,
                ts: ts ?? now(),
                ...rest,
              },
            ].slice(-500),
          }));
        },

        updateContractState: (
          id,
          state
        ) => {
          set((s) => ({
            contracts:
              s.contracts.map(
                (c) =>
                  c.id === id
                    ? {
                        ...c,
                        state,
                      }
                    : c
              ),
          }));
        },

        recordSettlement: (
          settlement
        ) => {
          set((s) => ({
            settlements: [
              settlement,
              ...s.settlements,
            ],

            contracts:
              s.contracts.map(
                (c) =>
                  c.id ===
                  settlement.contractId
                    ? {
                        ...c,

                        state:
                          "SETTLED",

                        status:
                          "SETTLED",

                        ledger:
                          settlement.ledger,

                        latencyMs:
                          settlement.latencyMs,

                        txHash:
                          settlement.txHash,
                      }
                    : c
              ),

            queue:
              s.queue.filter(
                (q) =>
                  q.contractId !==
                  settlement.contractId
              ),
          }));
        },

        ackAlert: (id) =>
          set((s) => ({
            alerts:
              s.alerts.filter(
                (a) =>
                  a.id !== id
              ),
          })),

        pushAlert: (a) => {
          set((s) => ({
            alerts: [
              {
                id: `A-${
                  s.counters.alert +
                  1
                }`,
                time: hhmm(),
                ...a,
              },

              ...s.alerts,
            ],
          }));
        },

        tick: () => {
          const s = get();

          const t = Date.now();

          if (
            t - s.lastTick <
            4500
          )
            return;

          const advanceIds =
            s.queue
              .slice(0, 2)
              .map((q) => q.id);

          const newQueue: QueueItem[] =
            [];

          const completed: QueueItem[] =
            [];

          s.queue.forEach((q) => {
            if (
              !advanceIds.includes(
                q.id
              )
            ) {
              newQueue.push(q);
              return;
            }

            const np = nextPhase(
              q.phase
            );

            if (np === "DONE") {
              completed.push(q);
            } else {
              newQueue.push({
                ...q,

                phase: np,

                state:
                  PHASE_TO_STATE[
                    np
                  ],
              });
            }
          });

          completed.forEach((q) => {
            const c =
              s.contracts.find(
                (cc) =>
                  cc.id ===
                  q.contractId
              );

            if (!c) return;

            (async () => {
              try {
                const result =
                  await executeSettlement();

                const stl: Settlement =
                  {
                    id: q.id,

                    contractId:
                      q.contractId,

                    counterparty:
                      q.counterparty,

                    amountBRL:
                      q.amount,

                    pld: c.pldBRL,

                    date: new Date()
                      .toISOString()
                      .slice(0, 16)
                      .replace(
                        "T",
                        " "
                      ),

                    txHash:
                      result.txHash,

                    ledger:
                      result.ledger,

                    latencyMs:
                      1800,

                    window:
                      c.window,

                    state:
                      "SETTLED",

                    status:
                      "CONFIRMED",
                  };

                get().recordSettlement(
                  stl
                );

                get().appendLog({
                  contractId:
                    q.contractId,

                  settlementId:
                    q.id,

                  state:
                    "SETTLED",

                  level: "ok",

                  message: `✓ ${q.id} finalized · ledger #${result.ledger}`,
                });
              } catch (err) {
                console.error(err);
              }
            })();
          });

          set({
            queue: newQueue,
            lastTick: t,
          });
        },

        reset: () =>
          set({
            contracts: mockContracts,
            settlements: [],
            alerts:
              operationalAlerts,
            queue:
              settlementQueue,
            feed:
              recentSettlementFeed,
            logs: seedLogs(),

            counters: {
              stl: 90220,
              epc: 2042,
              ledger: 58921500,
              alert: 123,
            },

            lastTick: 0,
          }),
      }),

      {
        name:
          "energypay.ops.v1",

        storage:
          createJSONStorage(
            () =>
              typeof window !==
              "undefined"
                ? window.localStorage
                : (undefined as unknown as Storage)
          ),
      }
    )
  );

/* ------------------------------------------------------------------ */
/* Background ticker */
/* ------------------------------------------------------------------ */

let tickerStarted = false;

export function startOpsTicker() {
  if (
    tickerStarted ||
    typeof window ===
      "undefined"
  )
    return;

  tickerStarted = true;

  setInterval(
    () =>
      useOps
        .getState()
        .tick(),
    5000
  );
}