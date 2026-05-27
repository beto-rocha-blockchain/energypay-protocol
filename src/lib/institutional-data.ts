/**
 * Institutional datasets shared across operational modules.
 * All data is sourced from real APIs (Supabase, Stellar Horizon, ONS).
 * No synthetic or mock data is generated in this file.
 */

export type Submercado = "SE/CO" | "S" | "NE" | "N";
export const SUBMERCADOS: Submercado[] = ["SE/CO", "S", "NE", "N"];

export type CounterpartyType =
  | "GENERATOR"
  | "DISTRIBUTOR"
  | "TRADER"
  | "RETAILER"
  | "CONSUMER"
  | "INVESTOR";

export type Counterparty = {
  id: string;
  legalName: string;
  shortName: string;
  cnpj: string;
  type: CounterpartyType;
  submercado: Submercado;
  rating: "AAA" | "AA" | "A" | "BBB" | "BB";
  exposureBRL: number;
  collateralBRL: number;
  collateralRatio: number; // 0-2
  settlementConfidence: number; // 0-100
  defaultProbBps: number; // basis points
  openContracts: number;
  status: "ACTIVE" | "MONITOR" | "RESTRICTED" | "SUSPENDED";
};

// Mock counterparty seed cleared — platform uses only real registered users.

// Mock counterparties cleared — platform shows only real registered users.
export const COUNTERPARTIES: Counterparty[] = [];

// ---------- Reconciliation exceptions ----------
export type ReconException = {
  id: string;
  counterparty: string;
  kind: "PRICE_MISMATCH" | "VOLUME_DRIFT" | "ORACLE_DIVERGENCE" | "LEDGER_GAP" | "TIMESTAMP_SKEW";
  severity: "INFO" | "WARN" | "CRITICAL";
  delta: string;
  openedAt: string;
  ageMin: number;
  state: "OPEN" | "INVESTIGATING" | "RESOLVED" | "ESCALATED";
};

export const RECON_EXCEPTIONS: ReconException[] = [];

// ---------- Operational alerts ----------
export type OpsAlert = {
  id: string;
  ts: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  source: string;
  message: string;
};

export const OPS_ALERTS: OpsAlert[] = [];

// ---------- KYC / compliance ----------
export type KycRecord = {
  cpId: string;
  shortName: string;
  level: "TIER-1" | "TIER-2" | "TIER-3";
  status: "VERIFIED" | "PENDING REVIEW" | "EXPIRING" | "REJECTED";
  lastReview: string;
  reviewer: string;
};

export const KYC_RECORDS: KycRecord[] = [];

// ---------- Network topology ----------
export type TopoNode = {
  id: string;
  label: string;
  type: CounterpartyType;
  submercado: Submercado;
  x: number; // 0-100
  y: number; // 0-100
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  loadMw: number;
};

export const TOPO_NODES: TopoNode[] = [];

export const TOPO_EDGES: Array<{
  from: string;
  to: string;
  mw: number;
  status: "FLOWING" | "STANDBY" | "STRESSED";
}> = [];

// ---------- Audit log ----------
export type AuditEntry = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  resource: string;
  ip: string;
  result: "OK" | "DENIED" | "ERROR";
  txHash?: string;
};

export const AUDIT_LOG: AuditEntry[] = [];

// ---------- Formatters ----------
export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRLm = (n: number) =>
  `R$ ${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
export const fmtNum = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtUTC = (iso: string) => new Date(iso).toUTCString().slice(17, 25);
export const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);
