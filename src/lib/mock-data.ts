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

export const mockContracts: Contract[] = [
  { id: "EPC-2041", buyer: "Metro Distribution Group", seller: "Meridian Trading Desk", volumeMWh: 2400, priceBRL: 248.5, pldBRL: 271.2, startDate: "2026-05-12", endDate: "2026-08-12", settlementDate: "2026-08-12", status: "ACTIVE", state: "PENDING_SIGNATURE", ledger: 58921412, latencyMs: 2380, window: "D+1 17:00 BRT", txHash: "a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4" },
  { id: "EPC-2040", buyer: "Voltix Energy Markets", seller: "Horizon Power Exchange", volumeMWh: 1800, priceBRL: 252.1, pldBRL: 264.8, startDate: "2026-04-10", endDate: "2026-07-10", settlementDate: "2026-07-10", status: "ACTIVE", state: "VALIDATED", ledger: 58921388, latencyMs: 2120, window: "D+1 17:00 BRT", txHash: "b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4" },
  { id: "EPC-2039", buyer: "Nexa Commercial Energy", seller: "Aurora Grid Energy", volumeMWh: 5200, priceBRL: 241.8, pldBRL: 258.0, startDate: "2026-06-01", endDate: "2026-12-01", settlementDate: "2026-12-01", status: "PENDING", state: "CREATED", ledger: 58921301, latencyMs: 2640, window: "D+1 17:00 BRT", txHash: "c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7" },
  { id: "EPC-2038", buyer: "UrbanGrid Cooperative", seller: "NovaHydro Power", volumeMWh: 3600, priceBRL: 239.4, pldBRL: 278.4, startDate: "2026-02-08", endDate: "2026-05-08", settlementDate: "2026-05-08", status: "SETTLED", state: "SETTLED", ledger: 58920871, latencyMs: 2210, window: "D+0 17:00 BRT", txHash: "d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3" },
  { id: "EPC-2037", buyer: "Delta Industrial Load", seller: "Solaris Renewables", volumeMWh: 980, priceBRL: 256.7, pldBRL: 237.1, startDate: "2026-01-07", endDate: "2026-05-07", settlementDate: "2026-05-07", status: "SETTLED", state: "SETTLED", ledger: 58920512, latencyMs: 1980, window: "D+0 17:00 BRT", txHash: "e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7" },
  { id: "EPC-2036", buyer: "Northline Utilities", seller: "Atlas Generation", volumeMWh: 1450, priceBRL: 244.2, pldBRL: 261.5, startDate: "2026-05-06", endDate: "2026-09-06", settlementDate: "2026-09-06", status: "ACTIVE", state: "BROADCASTING", ledger: 58921450, latencyMs: 2540, window: "D+1 17:00 BRT", txHash: "f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9b327ae84f1c9" },
  { id: "EPC-2035", buyer: "Northline Utilities", seller: "NovaHydro Power", volumeMWh: 2100, priceBRL: 246.0, pldBRL: 246.0, startDate: "2025-11-05", endDate: "2026-05-05", settlementDate: "2026-05-05", status: "FAILED", state: "FAILED", ledger: 0, latencyMs: 0, window: "D-1 17:00 BRT", txHash: "0000000000000000000000000000000000000000000000000000000000000000" },
];

export const mockSettlements: Settlement[] = [
  { id: "STL-90211", contractId: "EPC-2038", counterparty: "NovaHydro Power", amountBRL: 862400, pld: 278.4, date: "2026-05-05 14:22", txHash: "a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4a3f9c1e240b8d7f4", ledger: 58920871, latencyMs: 2210, window: "D+0 17:00 BRT", state: "SETTLED", status: "CONFIRMED" },
  { id: "STL-90210", contractId: "EPC-2037", counterparty: "Solaris Renewables", amountBRL: -19208, pld: 237.1, date: "2026-05-05 11:08", txHash: "b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4e2912ca5b8d4", ledger: 58920512, latencyMs: 1980, window: "D+0 17:00 BRT", state: "SETTLED", status: "CONFIRMED" },
  { id: "STL-90209", contractId: "EPC-2035", counterparty: "Atlas Generation", amountBRL: 412900, pld: 268.0, date: "2026-05-04 17:54", txHash: "c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7f03e8b91c1a7", ledger: 58919944, latencyMs: 2410, window: "D-1 17:00 BRT", state: "SETTLED", status: "CONFIRMED" },
  { id: "STL-90208", contractId: "EPC-2034", counterparty: "Meridian Trading Desk", amountBRL: 218750, pld: 261.5, date: "2026-05-04 09:31", txHash: "d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3e877c1f2d9b3", ledger: 58919712, latencyMs: 2080, window: "D-1 17:00 BRT", state: "SETTLED", status: "CONFIRMED" },
  { id: "STL-90207", contractId: "EPC-2033", counterparty: "Horizon Power Exchange", amountBRL: 154600, pld: 254.9, date: "2026-05-03 16:12", txHash: "e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7a188d310e2f7", ledger: 58919210, latencyMs: 2330, window: "D-2 17:00 BRT", state: "SETTLED", status: "CONFIRMED" },
];

export const volumeSeries = [
  { day: "Apr 28", volume: 12400, settled: 11800 },
  { day: "Apr 29", volume: 14200, settled: 13900 },
  { day: "Apr 30", volume: 9800, settled: 9600 },
  { day: "May 01", volume: 16700, settled: 16100 },
  { day: "May 02", volume: 18900, settled: 18400 },
  { day: "May 03", volume: 21200, settled: 20800 },
  { day: "May 04", volume: 19450, settled: 19100 },
  { day: "May 05", volume: 23800, settled: 22900 },
];

export const pldSeries = [
  { hour: "00h", pld: 241 }, { hour: "03h", pld: 238 }, { hour: "06h", pld: 244 },
  { hour: "09h", pld: 258 }, { hour: "12h", pld: 271 }, { hour: "15h", pld: 282 },
  { hour: "18h", pld: 294 }, { hour: "21h", pld: 263 },
];

export type TimelineEvent = {
  ts: string;
  label: string;
  detail: string;
  state: "done" | "active" | "pending";
};

export const settlementTimeline: TimelineEvent[] = [
  { ts: "T-04:12", label: "Contract created", detail: "EPC-2041 registered by Metro Distribution Group", state: "done" },
  { ts: "T-03:48", label: "Counterparty validated", detail: "KYC + clearing limits verified · Meridian Trading Desk", state: "done" },
  { ts: "T-02:20", label: "Exposure recalculated", detail: "GridRef oracle feed · R$ 271.20 / MWh", state: "done" },
  { ts: "T-00:42", label: "Settlement initiated", detail: "Net exposure computed · awaiting signature", state: "active" },
  { ts: "T+00:00", label: "Signed by operator", detail: "Atomic transfer broadcast to Stellar Testnet", state: "pending" },
  { ts: "T+00:08", label: "Settlement finalized", detail: "Reconciliation closed · ledger anchored", state: "pending" },
];

export const contractOperationalTimeline = (cid: string) => [
  { ts: "21:41:02", label: "Contract created", detail: `${cid} registered in clearing pool`, state: "done" as const },
  { ts: "21:41:48", label: "Counterparty validated", detail: "KYC, exposure limits & collateral verified", state: "done" as const },
  { ts: "21:42:11", label: "Exposure recalculated", detail: "PLD ingested from GridRef oracle feed", state: "done" as const },
  { ts: "21:42:33", label: "Settlement initiated", detail: "Operator queued atomic transfer", state: "done" as const },
  { ts: "21:42:35", label: "Signed by operator", detail: "EPWR keypair · ed25519 signature attached", state: "done" as const },
  { ts: "21:42:37", label: "Stellar confirmation received", detail: "Ledger anchored · finality 2.4s", state: "done" as const },
  { ts: "21:42:38", label: "Settlement finalized", detail: "Reconciliation closed · BRL leg cleared", state: "done" as const },
];

export type AlertItem = { id: string; level: "info" | "warn" | "critical"; title: string; detail: string; time: string };
export const operationalAlerts: AlertItem[] = [
  { id: "A-122", level: "warn", title: "Counterparty settlement delay detected", detail: "Horizon Power Exchange · ack pending > 90s on STL-90214", time: "12:18" },
  { id: "A-121", level: "warn", title: "Oracle synchronization latency", detail: "GridRef PLD feed · 6.2s lag vs. reference clock", time: "12:11" },
  { id: "A-120", level: "info", title: "Settlement retry initiated", detail: "STL-90209 · attempt 2/3 scheduled at T+00:05", time: "12:08" },
  { id: "A-119", level: "critical", title: "Exposure threshold exceeded", detail: "Sub-mercado SE/CO · +14.2% over T-1 close", time: "12:04" },
  { id: "A-118", level: "info", title: "Pending reconciliation queue increasing", detail: "12 → 18 items in last 15 min", time: "11:52" },
  { id: "A-117", level: "info", title: "Counterparty onboarded", detail: "Northline Utilities added to clearing pool", time: "11:31" },
];

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
export const settlementQueue: QueueItem[] = [
  { id: "STL-90213", contractId: "EPC-2041", counterparty: "Meridian Trading Desk", amount: 544800, eta: "00:42", phase: "signing", priority: "high", state: "PENDING_SIGNATURE" },
  { id: "STL-90214", contractId: "EPC-2040", counterparty: "Horizon Power Exchange", amount: 228600, eta: "01:15", phase: "validating", priority: "normal", state: "VALIDATED" },
  { id: "STL-90215", contractId: "EPC-2039", counterparty: "Aurora Grid Energy", amount: 842400, eta: "02:38", phase: "queued", priority: "high", state: "CREATED" },
  { id: "STL-90216", contractId: "EPC-2036", counterparty: "Atlas Generation", amount: 251285, eta: "04:10", phase: "broadcasting", priority: "normal", state: "BROADCASTING" },
  { id: "STL-90217", contractId: "EPC-2042", counterparty: "Delta Industrial Load", amount: 188900, eta: "05:24", phase: "queued", priority: "low", state: "CREATED" },
  { id: "STL-90218", contractId: "EPC-2043", counterparty: "UrbanGrid Cooperative", amount: 96420, eta: "07:02", phase: "queued", priority: "low", state: "CREATED" },
];

export type FeedItem = { id: string; counterparty: string; amount: number; ago: string };
export const recentSettlementFeed: FeedItem[] = [
  { id: "STL-90212", counterparty: "NovaHydro Power", amount: 862400, ago: "32s ago" },
  { id: "STL-90211", counterparty: "Solaris Renewables", amount: -19208, ago: "2m ago" },
  { id: "STL-90210", counterparty: "Atlas Generation", amount: 412900, ago: "6m ago" },
  { id: "STL-90209", counterparty: "Meridian Trading Desk", amount: 218750, ago: "11m ago" },
  { id: "STL-90208", counterparty: "Horizon Power Exchange", amount: 154600, ago: "18m ago" },
];
