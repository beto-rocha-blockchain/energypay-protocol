export type SettlementState =
  | "CREATED"
  | "VALIDATED"
  | "PENDING_SIGNATURE"
  | "BROADCASTING"
  | "CONFIRMED"
  | "SETTLED"
  | "FAILED";

export const SETTLEMENT_STATE_FLOW: SettlementState[] = [
  "CREATED",
  "VALIDATED",
  "PENDING_SIGNATURE",
  "BROADCASTING",
  "CONFIRMED",
  "SETTLED",
];

export type ContractStatus = "ACTIVE" | "SETTLED" | "PENDING" | "FAILED";

export type Contract = {
  id: string;
  buyer: string;
  seller: string;
  volumeMWh: number;
  priceBRL: number;
  pldBRL: number;
  settlementDate: string;
  startDate?: string;
  endDate?: string;
  status: ContractStatus;
  txHash: string;
  state: SettlementState;
  ledger: number;
  latencyMs: number;
  window: string;
};

export const computeExposure = (c: Contract) => (c.pldBRL - c.priceBRL) * c.volumeMWh;

export type ContractPeriodStatus = "UPCOMING" | "ACTIVE" | "EXPIRED";

/** Treat settlementDate as the contract end-date when explicit endDate is missing. */
export const contractEndDate = (c: Contract) => c.endDate ?? c.settlementDate;
/** Default start = 30d before end when not provided. */
export const contractStartDate = (c: Contract) => {
  if (c.startDate) return c.startDate;
  const end = new Date(contractEndDate(c) + "T00:00:00");
  end.setDate(end.getDate() - 30);
  return end.toISOString().slice(0, 10);
};

export const contractDurationDays = (c: Contract) => {
  const s = new Date(contractStartDate(c) + "T00:00:00").getTime();
  const e = new Date(contractEndDate(c) + "T00:00:00").getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
};

export const contractPeriodStatus = (c: Contract, ref: Date = new Date()): ContractPeriodStatus => {
  const today = new Date(ref.toISOString().slice(0, 10) + "T00:00:00").getTime();
  const s = new Date(contractStartDate(c) + "T00:00:00").getTime();
  const e = new Date(contractEndDate(c) + "T00:00:00").getTime();
  if (today < s) return "UPCOMING";
  if (today > e) return "EXPIRED";
  return "ACTIVE";
};

export type Settlement = {
  id: string;
  contractId: string;
  counterparty: string;
  amountBRL: number;
  pld: number;
  date: string;
  txHash: string;
  ledger: number;
  latencyMs: number;
  window: string;
  state: SettlementState;
  status: "CONFIRMED" | "PENDING" | "FAILED";
};

export const mockContracts: Contract[] = [];

export const mockSettlements: Settlement[] = [];

export type AlertItem = {
  id: string;
  level: "info" | "warn" | "critical";
  title: string;
  detail: string;
  time: string;
};
export const operationalAlerts: AlertItem[] = [];

export type QueuePhase = "queued" | "validating" | "signing" | "broadcasting" | "confirming";
export type QueuePriority = "high" | "normal" | "low";
export type QueueItem = {
  id: string;
  contractId: string;
  counterparty: string;
  amount: number;
  eta: string;
  phase: QueuePhase;
  priority: QueuePriority;
  state: SettlementState;
};
export const settlementQueue: QueueItem[] = [];

export type FeedItem = { id: string; counterparty: string; amount: number; ago: string };
export const recentSettlementFeed: FeedItem[] = [];
