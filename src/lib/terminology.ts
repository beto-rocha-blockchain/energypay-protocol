/**
 * EnergyPay canonical institutional terminology.
 * Single source of truth for lifecycle states, severities, submercados,
 * counterparty types, and operational vocabulary used across the OS.
 *
 * IMPORTANT: Avoid crypto vernacular ("mint", "burn", "swap", "gas").
 * Use clearing-house language: anchor, clear, settle, reverse, reconcile.
 */

// ─── Transaction / Settlement Lifecycle ──────────────────────────────
export const LIFECYCLE_STATES = [
  "INTAKE",      // received from intake gateway
  "VALIDATED",   // schema + counterparty checks passed
  "MATCHED",     // matched against bilateral or pool book
  "ANCHORED",    // anchored on Stellar ledger (txSubmitted)
  "CLEARED",     // finality + audit attestation complete
  "SETTLED",     // financial settlement finalized
  "REJECTED",    // failed validation/match
  "REVERSED",    // post-clearing reversal (compliance / exception)
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const LIFECYCLE_TERMINAL: LifecycleState[] = ["SETTLED", "REJECTED", "REVERSED"];

export const lifecycleLabel = (s: LifecycleState): string => s;
export const lifecycleSeverity = (s: LifecycleState): Severity => {
  if (s === "SETTLED" || s === "CLEARED") return "NOMINAL";
  if (s === "REJECTED" || s === "REVERSED") return "CRITICAL";
  if (s === "ANCHORED" || s === "MATCHED") return "ELEVATED";
  return "ELEVATED";
};

// ─── Operational Severity ────────────────────────────────────────────
export const SEVERITIES = ["NOMINAL", "ELEVATED", "DEGRADED", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Legacy → canonical mapping
export const toSeverity = (s: string | undefined): Severity => {
  switch ((s ?? "").toUpperCase()) {
    case "OK":
    case "INFO":
    case "ONLINE":
    case "SUCCESS":
    case "ACTIVE":
    case "NOMINAL":
      return "NOMINAL";
    case "WARN":
    case "WARNING":
    case "MONITOR":
    case "ELEVATED":
    case "PENDING":
      return "ELEVATED";
    case "DEGRADED":
    case "RESTRICTED":
      return "DEGRADED";
    case "CRITICAL":
    case "ERROR":
    case "FAILED":
    case "OFFLINE":
    case "SUSPENDED":
    case "DENIED":
      return "CRITICAL";
    default:
      return "NOMINAL";
  }
};

// ─── Submercados (ANEEL / ONS / CCEE) ────────────────────────────────
export const SUBMERCADO_CODES = ["SE_CO", "S", "NE", "N"] as const;
export type SubmercadoCode = (typeof SUBMERCADO_CODES)[number];

export const SUBMERCADO_LABEL: Record<SubmercadoCode, string> = {
  SE_CO: "Sudeste / Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
};
export const SUBMERCADO_SHORT: Record<SubmercadoCode, string> = {
  SE_CO: "SE/CO",
  S: "S",
  NE: "NE",
  N: "N",
};
export const PLD_FEED_ID = (sm: SubmercadoCode) => `PLD.${sm}.HOURLY`;

// ─── Counterparty / Operator schemas (canonical) ─────────────────────
export type CounterpartyType =
  | "GENERATOR"
  | "DISTRIBUTOR"
  | "TRADER"
  | "RETAILER"
  | "CONSUMER"
  | "INVESTOR";

export type CreditRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";

// ─── Audit event categories ──────────────────────────────────────────
export const AUDIT_ACTIONS = [
  "SETTLEMENT_BROADCAST",
  "SETTLEMENT_ANCHORED",
  "MARGIN_CALL_ISSUED",
  "CONTRACT_APPROVED",
  "CONTRACT_REJECTED",
  "ORACLE_OVERRIDE",
  "ORACLE_FALLBACK_ARMED",
  "KYC_REVIEW",
  "LEDGER_ANCHOR",
  "OPERATOR_LOGIN",
  "OPERATOR_LOGOUT",
  "POLICY_UPDATE",
  "EXCEPTION_ESCALATED",
  "EXCEPTION_RESOLVED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ─── Telemetry channels (for live store) ─────────────────────────────
export const TELEMETRY_CHANNELS = [
  "settlements",
  "clearing",
  "reconciliation",
  "oracle",
  "risk",
  "treasury",
  "audit",
  "topology",
  "rail",
] as const;
export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number];

// ─── Realistic latency bands (ms) for clearing operations ────────────
export const LATENCY_BANDS = {
  intake_ms: { p50: 38, p95: 120, p99: 280 },
  validation_ms: { p50: 64, p95: 180, p99: 410 },
  matching_ms: { p50: 110, p95: 320, p99: 720 },
  anchor_ms: { p50: 4200, p95: 6100, p99: 8900 }, // Stellar 5s ledger close
  clearing_ms: { p50: 5200, p95: 7400, p99: 11200 },
} as const;
