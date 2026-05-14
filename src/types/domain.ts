/**
 * EnergyPay canonical domain types.
 *
 * These types are the contract between UI and services. The mock service
 * layer (src/services/*) and any future real backend adapter MUST conform
 * to these shapes. Validate with Zod at the transport boundary.
 *
 * Time: all timestamps are ISO-8601 UTC strings.
 * Currency: BRL amounts in *centavos* are NOT used here — all monetary
 *   values are in BRL units (Number) for institutional dashboards.
 *   Settlement layer should re-scale to integer minor units when sending
 *   to the ledger.
 */
import { z } from "zod";
import type {
  LifecycleState,
  Severity,
  SubmercadoCode,
  CounterpartyType,
  CreditRating,
  AuditAction,
} from "@/lib/terminology";

// ─── Counterparty ────────────────────────────────────────────────────
export const zCounterparty = z.object({
  id: z.string(), // "EP-CP-0042"
  legalName: z.string(),
  shortName: z.string(),
  cnpj: z.string(),
  operatorCode: z.string().optional(), // e.g. "ELET3-OP"
  type: z.custom<CounterpartyType>(),
  submercado: z.custom<SubmercadoCode>(),
  rating: z.custom<CreditRating>(),
  status: z.enum(["ACTIVE", "MONITOR", "RESTRICTED", "SUSPENDED"]),
});
export type Counterparty = z.infer<typeof zCounterparty>;

// ─── Operator identity ───────────────────────────────────────────────
export const zOperatorIdentity = z.object({
  id: z.string(), // "OP-7741"
  email: z.string(),
  displayName: z.string(),
  roles: z.array(
    z.enum(["VIEWER", "OPERATOR", "SUPERVISOR", "RISK", "COMPLIANCE", "ADMIN"]),
  ),
  sessionId: z.string(),
  sessionStartedAt: z.string(),
  ipMasked: z.string().optional(),
});
export type OperatorIdentity = z.infer<typeof zOperatorIdentity>;

// ─── Bilateral contract ──────────────────────────────────────────────
export const zBilateralContract = z.object({
  id: z.string(), // "EPC-2058"
  buyerId: z.string(),
  sellerId: z.string(),
  buyerName: z.string(),
  sellerName: z.string(),
  submercado: z.custom<SubmercadoCode>(),
  notionalBRL: z.number(),
  volumeMWh: z.number(),
  priceBRLPerMWh: z.number(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum([
    "DRAFT",
    "PENDING_APPROVAL",
    "ACTIVE",
    "DELIVERING",
    "SUSPENDED",
    "CLOSED",
    "TERMINATED",
  ]),
  deliveredMWh: z.number(),
  marginPostedBRL: z.number(),
  mtmBRL: z.number(),
});
export type BilateralContract = z.infer<typeof zBilateralContract>;

// ─── Ledger operation (Stellar) ──────────────────────────────────────
export const zLedgerOperation = z.object({
  id: z.string(),
  ledgerSeq: z.number(),
  txHash: z.string(),
  opIndex: z.number(),
  opType: z.enum([
    "payment",
    "create_account",
    "change_trust",
    "manage_sell_offer",
    "manage_buy_offer",
    "path_payment_strict_send",
    "set_options",
    "manage_data",
  ]),
  sourceAccount: z.string(),
  destinationAccount: z.string().optional(),
  amount: z.string().optional(),
  assetCode: z.string().optional(),
  assetIssuer: z.string().optional(),
  createdAt: z.string(),
  feeChargedStroops: z.number().optional(),
});
export type LedgerOperation = z.infer<typeof zLedgerOperation>;

// ─── Settlement event (canonical) ────────────────────────────────────
export const zSettlementEvent = z.object({
  id: z.string(),
  correlationId: z.string(),
  contractId: z.string().optional(),
  counterpartyId: z.string().optional(),
  lifecycle: z.custom<LifecycleState>(),
  severity: z.custom<Severity>().optional(),
  notionalBRL: z.number().optional(),
  volumeMWh: z.number().optional(),
  txHash: z.string().optional(),
  ledgerSeq: z.number().optional(),
  submittedAt: z.string(),
  anchoredAt: z.string().optional(),
  clearedAt: z.string().optional(),
  settledAt: z.string().optional(),
  rejectedAt: z.string().optional(),
  latencyMs: z.number().optional(),
  channel: z.enum(["BILATERAL", "POOL", "P2P", "OTC"]),
  failureCode: z.string().optional(),
  failureReason: z.string().optional(),
  retries: z.number().default(0),
});
export type SettlementEvent = z.infer<typeof zSettlementEvent>;

// ─── Reconciliation row ──────────────────────────────────────────────
export const zReconciliationRow = z.object({
  id: z.string(),
  counterpartyId: z.string(),
  counterpartyName: z.string(),
  kind: z.enum([
    "PRICE_MISMATCH",
    "VOLUME_DRIFT",
    "ORACLE_DIVERGENCE",
    "LEDGER_GAP",
    "TIMESTAMP_SKEW",
    "DUPLICATE_TX",
  ]),
  severity: z.custom<Severity>(),
  state: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED"]),
  mismatchDelta: z.string(), // human-readable Δ
  tolerance: z.string(), // operational tolerance window
  retryCount: z.number(),
  fallbackChannel: z.enum(["NONE", "ORACLE_SECONDARY", "MANUAL_REVIEW", "REPLAY"]),
  oracleSignerCount: z.number().optional(),
  openedAt: z.string(),
  ageMin: z.number(),
  assignedTo: z.string().optional(),
  correlationId: z.string().optional(),
});
export type ReconciliationRow = z.infer<typeof zReconciliationRow>;

// ─── Oracle sample (PLD reference data) ──────────────────────────────
export const zOracleSample = z.object({
  feedId: z.string(), // PLD.SE_CO.HOURLY
  submercado: z.custom<SubmercadoCode>(),
  observedAt: z.string(),
  priceBRLPerMWh: z.number(),
  signerCount: z.number(),
  divergencePct: z.number(),
  latencyMs: z.number(),
  source: z.enum(["CCEE_PRIMARY", "CCEE_SECONDARY", "FALLBACK_AGGREGATE"]),
});
export type OracleSample = z.infer<typeof zOracleSample>;

// ─── Risk exposure ───────────────────────────────────────────────────
export const zRiskExposure = z.object({
  counterpartyId: z.string(),
  counterpartyName: z.string(),
  grossBRL: z.number(),
  netBRL: z.number(),
  collateralBRL: z.number(),
  uncoveredBRL: z.number(),
  coverageRatio: z.number(),
  defaultProbBps: z.number(),
  ratingPenaltyBps: z.number(),
  severity: z.custom<Severity>(),
  asOf: z.string(),
});
export type RiskExposure = z.infer<typeof zRiskExposure>;

// ─── Treasury balance ────────────────────────────────────────────────
export const zTreasuryBalance = z.object({
  accountId: z.string(),
  label: z.string(),
  assetCode: z.string(),
  assetIssuer: z.string().optional(),
  balance: z.number(),
  reservedBalance: z.number().optional(),
  trustlineLimit: z.number().optional(),
  asOf: z.string(),
});
export type TreasuryBalance = z.infer<typeof zTreasuryBalance>;

// ─── Audit event ─────────────────────────────────────────────────────
export const zAuditEvent = z.object({
  id: z.string(),
  ts: z.string(),
  actor: z.string(),
  operatorId: z.string().optional(),
  sessionId: z.string().optional(),
  ipMasked: z.string().optional(),
  correlationId: z.string().optional(),
  parentEventId: z.string().optional(),
  action: z.custom<AuditAction>(),
  resource: z.string(),
  result: z.enum(["OK", "DENIED", "ERROR"]),
  severity: z.custom<Severity>().optional(),
  txHash: z.string().optional(),
  ledgerSeq: z.number().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof zAuditEvent>;

// ─── Async result envelope (for service layer) ───────────────────────
export type ListResult<T> = {
  items: T[];
  total: number;
  asOf: string;
  source: "MOCK" | "LIVE";
  /** True when data is older than its freshness budget */
  degraded?: boolean;
};

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
