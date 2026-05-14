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

export type ContractStatus =
  | "ACTIVE"
  | "SETTLED"
  | "PENDING"
  | "FAILED";

export type Contract = {
  id: string;
  buyer: string;
  seller: string;
  volumeMWh: number;
  priceBRL: number;
  pldBRL: number;
  settlementDate: string;
  status: ContractStatus;
  txHash: string;
  state: SettlementState;
  ledger: number;
  latencyMs: number;
  window: string;
};

export const computeExposure = (
  c: Contract
) => (c.pldBRL - c.priceBRL) * c.volumeMWh;

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
  status:
    | "CONFIRMED"
    | "PENDING"
    | "FAILED";
};

export const volumeSeries = [
  {
    day: "Apr 28",
    volume: 12400,
    settled: 11800,
  },
  {
    day: "Apr 29",
    volume: 14200,
    settled: 13900,
  },
  {
    day: "Apr 30",
    volume: 9800,
    settled: 9600,
  },
  {
    day: "May 01",
    volume: 16700,
    settled: 16100,
  },
  {
    day: "May 02",
    volume: 18900,
    settled: 18400,
  },
  {
    day: "May 03",
    volume: 21200,
    settled: 20800,
  },
  {
    day: "May 04",
    volume: 19450,
    settled: 19100,
  },
  {
    day: "May 05",
    volume: 23800,
    settled: 22900,
  },
];

export const pldSeries = [
  { hour: "00h", pld: 241 },
  { hour: "03h", pld: 238 },
  { hour: "06h", pld: 244 },
  { hour: "09h", pld: 258 },
  { hour: "12h", pld: 271 },
  { hour: "15h", pld: 282 },
  { hour: "18h", pld: 294 },
  { hour: "21h", pld: 263 },
];

export type TimelineEvent = {
  ts: string;
  label: string;
  detail: string;
  state:
    | "done"
    | "active"
    | "pending";
};

export const settlementTimeline: TimelineEvent[] =
  [
    {
      ts: "T-04:12",
      label: "Contract created",
      detail:
        "EPC-2041 registered by Vale Energia S.A.",
      state: "done",
    },
    {
      ts: "T-03:48",
      label: "Counterparty validated",
      detail:
        "KYC + clearing limits verified · Engie Brasil",
      state: "done",
    },
    {
      ts: "T-02:20",
      label: "Exposure recalculated",
      detail:
        "CCEE oracle feed · R$ 271.20 / MWh",
      state: "done",
    },
    {
      ts: "T-00:42",
      label: "Settlement initiated",
      detail:
        "Net exposure computed · awaiting signature",
      state: "active",
    },
    {
      ts: "T+00:00",
      label: "Signed by operator",
      detail:
        "Atomic transfer broadcast to Stellar Testnet",
      state: "pending",
    },
    {
      ts: "T+00:08",
      label: "Settlement finalized",
      detail:
        "Reconciliation closed · ledger anchored",
      state: "pending",
    },
  ];

export const contractOperationalTimeline = (
  cid: string
) => [
  {
    ts: "21:41:02",
    label: "Contract created",
    detail: `${cid} registered in clearing pool`,
    state: "done" as const,
  },
  {
    ts: "21:41:48",
    label: "Counterparty validated",
    detail:
      "KYC, exposure limits & collateral verified",
    state: "done" as const,
  },
  {
    ts: "21:42:11",
    label: "Exposure recalculated",
    detail:
      "PLD ingested from CCEE oracle feed",
    state: "done" as const,
  },
  {
    ts: "21:42:33",
    label: "Settlement initiated",
    detail:
      "Operator queued atomic transfer",
    state: "done" as const,
  },
  {
    ts: "21:42:35",
    label: "Signed by operator",
    detail:
      "EPWR keypair · ed25519 signature attached",
    state: "done" as const,
  },
  {
    ts: "21:42:37",
    label:
      "Stellar confirmation received",
    detail:
      "Ledger anchored · finality 2.4s",
    state: "done" as const,
  },
  {
    ts: "21:42:38",
    label: "Settlement finalized",
    detail:
      "Reconciliation closed · BRL leg cleared",
    state: "done" as const,
  },
];

export type AlertItem = {
  id: string;
  level:
    | "info"
    | "warn"
    | "critical";
  title: string;
  detail: string;
  time: string;
};

export const operationalAlerts: AlertItem[] =
  [
    {
      id: "A-122",
      level: "warn",
      title:
        "Counterparty settlement delay detected",
      detail:
        "EDP Brasil · ack pending > 90s on STL-90214",
      time: "12:18",
    },
    {
      id: "A-121",
      level: "warn",
      title:
        "Oracle synchronization latency",
      detail:
        "CCEE PLD feed · 6.2s lag vs. reference clock",
      time: "12:11",
    },
    {
      id: "A-120",
      level: "info",
      title:
        "Settlement retry initiated",
      detail:
        "STL-90209 · attempt 2/3 scheduled at T+00:05",
      time: "12:08",
    },
    {
      id: "A-119",
      level: "critical",
      title:
        "Exposure threshold exceeded",
      detail:
        "Sub-mercado SE/CO · +14.2% over T-1 close",
      time: "12:04",
    },
    {
      id: "A-118",
      level: "info",
      title:
        "Pending reconciliation queue increasing",
      detail:
        "12 → 18 items in last 15 min",
      time: "11:52",
    },
    {
      id: "A-117",
      level: "info",
      title:
        "Counterparty onboarded",
      detail:
        "Equatorial Energia added to clearing pool",
      time: "11:31",
    },
  ];

export type QueuePhase =
  | "queued"
  | "validating"
  | "signing"
  | "broadcasting"
  | "confirming";

export type QueuePriority =
  | "high"
  | "normal"
  | "low";

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
  {
    id: "STL-90213",
    contractId: "EPC-2041",
    counterparty: "Engie Brasil",
    amount: 544800,
    eta: "00:42",
    phase: "signing",
    priority: "high",
    state: "PENDING_SIGNATURE",
  },
  {
    id: "STL-90214",
    contractId: "EPC-2040",
    counterparty: "EDP Brasil",
    amount: 228600,
    eta: "01:15",
    phase: "validating",
    priority: "normal",
    state: "VALIDATED",
  },
];

export type FeedItem = {
  id: string;
  counterparty: string;
  amount: number;
  ago: string;
};

export const recentSettlementFeed: FeedItem[] = [];
  export const mockContracts: Contract[] = [];