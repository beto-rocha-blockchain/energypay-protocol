/**
 * Deterministic institutional datasets shared across operational modules.
 * Pure client-side simulation grounded in realistic Brazilian power-market
 * terminology (submercados SE/S/NE/N, PLD reference, ONS dispatch).
 *
 * A single seed source keeps numbers tied together across pages so the UI
 * feels like a real settlement infrastructure platform.
 */

// Mulberry32 — small deterministic PRNG
const prng = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

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

const COUNTERPARTY_SEED: Array<Omit<Counterparty,
  "exposureBRL" | "collateralBRL" | "collateralRatio" | "settlementConfidence" | "defaultProbBps" | "openContracts" | "status"
>> = [
  { id: "EP-CP-0042", legalName: "Eletrobras S.A.", shortName: "Eletrobras", cnpj: "00.001.180/0001-26", type: "GENERATOR", submercado: "SE/CO", rating: "AAA" },
  { id: "EP-CP-0061", legalName: "Engie Brasil Energia S.A.", shortName: "Engie BR", cnpj: "02.474.103/0001-19", type: "GENERATOR", submercado: "S", rating: "AA" },
  { id: "EP-CP-0073", legalName: "AES Brasil Operações S.A.", shortName: "AES Brasil", cnpj: "37.663.076/0001-07", type: "GENERATOR", submercado: "SE/CO", rating: "AA" },
  { id: "EP-CP-0078", legalName: "Auren Energia S.A.", shortName: "Auren", cnpj: "11.341.842/0001-26", type: "GENERATOR", submercado: "SE/CO", rating: "A" },
  { id: "EP-CP-0084", legalName: "CTG Brasil Energia", shortName: "CTG Brasil", cnpj: "11.342.999/0001-39", type: "GENERATOR", submercado: "SE/CO", rating: "A" },
  { id: "EP-CP-0091", legalName: "Cemig Distribuição S.A.", shortName: "Cemig D", cnpj: "06.981.180/0001-16", type: "DISTRIBUTOR", submercado: "SE/CO", rating: "A" },
  { id: "EP-CP-0095", legalName: "Equatorial Energia S.A.", shortName: "Equatorial", cnpj: "03.220.438/0001-73", type: "DISTRIBUTOR", submercado: "NE", rating: "A" },
  { id: "EP-CP-0102", legalName: "Neoenergia S.A.", shortName: "Neoenergia", cnpj: "01.083.200/0001-18", type: "DISTRIBUTOR", submercado: "NE", rating: "AA" },
  { id: "EP-CP-0114", legalName: "EDP Brasil S.A.", shortName: "EDP", cnpj: "03.983.431/0001-03", type: "RETAILER", submercado: "SE/CO", rating: "A" },
  { id: "EP-CP-0118", legalName: "Comerc Energia S.A.", shortName: "Comerc", cnpj: "04.812.243/0001-28", type: "TRADER", submercado: "SE/CO", rating: "BBB" },
  { id: "EP-CP-0121", legalName: "Vale S.A. — Energia", shortName: "Vale Energia", cnpj: "33.592.510/0001-54", type: "CONSUMER", submercado: "SE/CO", rating: "AAA" },
  { id: "EP-CP-0129", legalName: "Klabin S.A.", shortName: "Klabin", cnpj: "89.637.490/0001-45", type: "CONSUMER", submercado: "S", rating: "AA" },
  { id: "EP-CP-0136", legalName: "Suzano Papel e Celulose", shortName: "Suzano", cnpj: "16.404.287/0001-55", type: "CONSUMER", submercado: "SE/CO", rating: "AA" },
  { id: "EP-CP-0140", legalName: "Vibra Energia S.A.", shortName: "Vibra", cnpj: "33.000.167/0001-01", type: "TRADER", submercado: "SE/CO", rating: "A" },
  { id: "EP-CP-0148", legalName: "BTG Pactual Infra IV FIP", shortName: "BTG Infra IV", cnpj: "30.306.294/0001-45", type: "INVESTOR", submercado: "SE/CO", rating: "AA" },
  { id: "EP-CP-0152", legalName: "Pátria Energia Renovável", shortName: "Pátria Renew", cnpj: "32.500.214/0001-77", type: "INVESTOR", submercado: "SE/CO", rating: "A" },
];

export const COUNTERPARTIES: Counterparty[] = COUNTERPARTY_SEED.map((s, i) => {
  const r = prng(0xc0ffee + i * 17);
  const exposure = Math.round((4_000_000 + r() * 95_000_000) / 1000) * 1000;
  const ratio = 0.95 + r() * 0.9;
  const collateral = Math.round(exposure * ratio);
  const conf = 100 - Math.round(r() * (s.rating === "AAA" ? 6 : s.rating === "AA" ? 14 : s.rating === "A" ? 24 : 38));
  const dprob = Math.round((s.rating === "AAA" ? 3 : s.rating === "AA" ? 12 : s.rating === "A" ? 35 : 110) + r() * 40);
  const open = 1 + Math.floor(r() * 18);
  const status: Counterparty["status"] =
    ratio < 1.0 ? "MONITOR" : conf < 70 ? "RESTRICTED" : "ACTIVE";
  return {
    ...s,
    exposureBRL: exposure,
    collateralBRL: collateral,
    collateralRatio: Number(ratio.toFixed(2)),
    settlementConfidence: conf,
    defaultProbBps: dprob,
    openContracts: open,
    status,
  };
});

// ---------- PLD curves (R$/MWh) ----------
export type PldPoint = { t: string; SECO: number; S: number; NE: number; N: number };

export const buildPldSeries = (hours = 48, seed = 0xa11ce): PldPoint[] => {
  const r = prng(seed);
  const now = Date.now();
  const out: PldPoint[] = [];
  let baseSE = 220 + r() * 60;
  let baseS = 180 + r() * 40;
  let baseNE = 260 + r() * 80;
  let baseN = 200 + r() * 60;
  for (let i = hours - 1; i >= 0; i--) {
    const ts = new Date(now - i * 3600_000);
    const hour = ts.getUTCHours();
    const peak = hour >= 17 && hour <= 21 ? 1.18 : hour >= 10 && hour <= 15 ? 1.06 : 0.94;
    baseSE = Math.max(60, baseSE + (r() - 0.5) * 18);
    baseS = Math.max(60, baseS + (r() - 0.5) * 14);
    baseNE = Math.max(60, baseNE + (r() - 0.5) * 22);
    baseN = Math.max(60, baseN + (r() - 0.5) * 16);
    out.push({
      t: ts.toISOString(),
      SECO: Math.round(baseSE * peak),
      S: Math.round(baseS * peak),
      NE: Math.round(baseNE * peak),
      N: Math.round(baseN * peak),
    });
  }
  return out;
};

// ---------- Settlement throughput ----------
export type ThroughputPoint = { t: string; tpm: number; notional: number; finality: number };

export const buildThroughput = (minutes = 60, seed = 0xdeadbeef): ThroughputPoint[] => {
  const r = prng(seed);
  const now = Date.now();
  const out: ThroughputPoint[] = [];
  for (let i = minutes - 1; i >= 0; i--) {
    const ts = new Date(now - i * 60_000);
    const tpm = Math.max(2, Math.round(18 + Math.sin(i / 6) * 8 + r() * 6));
    const notional = tpm * (180_000 + r() * 90_000);
    const finality = Math.round(3800 + r() * 1800);
    out.push({ t: ts.toISOString(), tpm, notional, finality });
  }
  return out;
};

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

export const RECON_EXCEPTIONS: ReconException[] = (() => {
  const kinds: ReconException["kind"][] = ["PRICE_MISMATCH", "VOLUME_DRIFT", "ORACLE_DIVERGENCE", "LEDGER_GAP", "TIMESTAMP_SKEW"];
  const sev: ReconException["severity"][] = ["INFO", "WARN", "CRITICAL"];
  const st: ReconException["state"][] = ["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED"];
  return Array.from({ length: 14 }).map((_, i) => {
    const r = prng(0xbeef + i * 91);
    const cp = COUNTERPARTIES[Math.floor(r() * COUNTERPARTIES.length)];
    const k = kinds[Math.floor(r() * kinds.length)];
    const s = sev[Math.min(2, Math.floor(r() * 3.4))];
    const age = Math.floor(r() * 220);
    const delta =
      k === "PRICE_MISMATCH" ? `Δ R$ ${(r() * 14).toFixed(2)}/MWh` :
      k === "VOLUME_DRIFT"   ? `Δ ${(r() * 8.4).toFixed(2)} MWh` :
      k === "ORACLE_DIVERGENCE" ? `${(r() * 1.8).toFixed(2)}% div` :
      k === "LEDGER_GAP"     ? `seq −${Math.floor(r() * 3) + 1}` :
                                `${Math.floor(r() * 450)} ms`;
    return {
      id: `EX-${String(38210 + i).padStart(5, "0")}`,
      counterparty: cp.shortName,
      kind: k,
      severity: s,
      delta,
      openedAt: new Date(Date.now() - age * 60_000).toISOString(),
      ageMin: age,
      state: st[Math.floor(r() * (s === "CRITICAL" ? 3 : 4))],
    };
  });
})();

// ---------- Operational alerts ----------
export type OpsAlert = {
  id: string;
  ts: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  source: string;
  message: string;
};

export const OPS_ALERTS: OpsAlert[] = [
  { id: "A-9821", ts: new Date(Date.now() - 60_000).toISOString(), severity: "WARN", source: "PLD-FEED-SECO", message: "Reference feed latency above 1.5s threshold — fallback oracle armed." },
  { id: "A-9817", ts: new Date(Date.now() - 6 * 60_000).toISOString(), severity: "CRITICAL", source: "CLR-MARGIN", message: "Counterparty Comerc Energia — collateral ratio 0.97× below floor 1.00×." },
  { id: "A-9810", ts: new Date(Date.now() - 14 * 60_000).toISOString(), severity: "INFO", source: "STELLAR-RAIL", message: "Horizon finality p95 within nominal envelope (4.1s)." },
  { id: "A-9805", ts: new Date(Date.now() - 22 * 60_000).toISOString(), severity: "WARN", source: "RECON-ENGINE", message: "4 open price-mismatch exceptions on submercado NE — investigating." },
  { id: "A-9799", ts: new Date(Date.now() - 41 * 60_000).toISOString(), severity: "INFO", source: "AUDIT", message: "Daily compliance attestation packet anchored — block 51 224 197." },
  { id: "A-9788", ts: new Date(Date.now() - 73 * 60_000).toISOString(), severity: "WARN", source: "CUSTODY", message: "Settlement guarantee pool utilization at 71% — within tolerance." },
];

// ---------- KYC / compliance ----------
export type KycRecord = {
  cpId: string;
  shortName: string;
  level: "TIER-1" | "TIER-2" | "TIER-3";
  status: "VERIFIED" | "PENDING REVIEW" | "EXPIRING" | "REJECTED";
  lastReview: string;
  reviewer: string;
};

export const KYC_RECORDS: KycRecord[] = COUNTERPARTIES.slice(0, 12).map((c, i) => {
  const r = prng(0xfee1 + i * 31);
  const tier = c.rating === "AAA" || c.rating === "AA" ? "TIER-1" : c.rating === "A" ? "TIER-2" : "TIER-3";
  const days = Math.floor(r() * 280);
  const status: KycRecord["status"] =
    days > 240 ? "EXPIRING" : r() > 0.92 ? "PENDING REVIEW" : "VERIFIED";
  return {
    cpId: c.id,
    shortName: c.shortName,
    level: tier,
    status,
    lastReview: new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10),
    reviewer: ["ops.cardoso", "ops.menezes", "compliance.silva", "supervisor.dias"][i % 4],
  };
});

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

export const TOPO_NODES: TopoNode[] = [
  { id: "N-NE-01", label: "Itaparica HPP",     type: "GENERATOR",   submercado: "NE",    x: 71, y: 32, status: "ONLINE",   loadMw: 1480 },
  { id: "N-NE-02", label: "Neoenergia BA",     type: "DISTRIBUTOR", submercado: "NE",    x: 78, y: 40, status: "ONLINE",   loadMw: 920  },
  { id: "N-N-01",  label: "Tucuruí HPP",       type: "GENERATOR",   submercado: "N",     x: 58, y: 18, status: "DEGRADED", loadMw: 3210 },
  { id: "N-N-02",  label: "Equatorial PA",     type: "DISTRIBUTOR", submercado: "N",     x: 50, y: 24, status: "ONLINE",   loadMw: 540  },
  { id: "N-SE-01", label: "Itaipu (BR)",       type: "GENERATOR",   submercado: "SE/CO", x: 38, y: 62, status: "ONLINE",   loadMw: 6810 },
  { id: "N-SE-02", label: "Cemig D MG",        type: "DISTRIBUTOR", submercado: "SE/CO", x: 56, y: 56, status: "ONLINE",   loadMw: 2140 },
  { id: "N-SE-03", label: "Vale Carajás",      type: "CONSUMER",    submercado: "SE/CO", x: 64, y: 48, status: "ONLINE",   loadMw: 1820 },
  { id: "N-SE-04", label: "Auren Trading Desk",type: "TRADER",      submercado: "SE/CO", x: 52, y: 68, status: "ONLINE",   loadMw: 0    },
  { id: "N-SE-05", label: "EDP Retail SP",     type: "RETAILER",    submercado: "SE/CO", x: 48, y: 74, status: "DEGRADED", loadMw: 760  },
  { id: "N-S-01",  label: "Engie Jorge Lacerda",type:"GENERATOR",   submercado: "S",     x: 44, y: 86, status: "ONLINE",   loadMw: 880  },
  { id: "N-S-02",  label: "Klabin Telêmaco",   type: "CONSUMER",    submercado: "S",     x: 40, y: 80, status: "ONLINE",   loadMw: 410  },
  { id: "N-INV-01",label: "BTG Infra IV FIP",  type: "INVESTOR",    submercado: "SE/CO", x: 30, y: 70, status: "ONLINE",   loadMw: 0    },
];

export const TOPO_EDGES: Array<{ from: string; to: string; mw: number; status: "FLOWING" | "STANDBY" | "STRESSED" }> = [
  { from: "N-SE-01", to: "N-SE-02", mw: 2140, status: "FLOWING" },
  { from: "N-SE-01", to: "N-SE-05", mw: 760, status: "STRESSED" },
  { from: "N-SE-02", to: "N-SE-03", mw: 1820, status: "FLOWING" },
  { from: "N-S-01", to: "N-S-02", mw: 410, status: "FLOWING" },
  { from: "N-NE-01", to: "N-NE-02", mw: 920, status: "FLOWING" },
  { from: "N-N-01", to: "N-N-02", mw: 540, status: "FLOWING" },
  { from: "N-N-01", to: "N-NE-01", mw: 1300, status: "FLOWING" },
  { from: "N-SE-04", to: "N-SE-02", mw: 0, status: "STANDBY" },
  { from: "N-INV-01", to: "N-SE-04", mw: 0, status: "STANDBY" },
];

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

export const AUDIT_LOG: AuditEntry[] = Array.from({ length: 24 }).map((_, i) => {
  const r = prng(0xabba + i * 13);
  const actors = ["ops.cardoso", "ops.menezes", "supervisor.dias", "clearing.admin", "compliance.silva", "system.adapter"];
  const actions = ["SETTLEMENT_BROADCAST", "MARGIN_CALL_ISSUED", "CONTRACT_APPROVED", "ORACLE_OVERRIDE", "KYC_REVIEW", "LEDGER_ANCHOR", "OPERATOR_LOGIN", "FALLBACK_ARMED"];
  const resources = ["EPC-2058", "EPC-2061", "EPC-2070", "CP/EP-CP-0118", "feed/PLD-SECO", "tx/9f3ab2…", "session/op-7741", "policy/clr-margin-v3"];
  const ip = `10.${42 + Math.floor(r() * 8)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`;
  const result: AuditEntry["result"] = r() > 0.94 ? "DENIED" : r() > 0.97 ? "ERROR" : "OK";
  return {
    id: `AU-${String(771204 + i).padStart(6, "0")}`,
    ts: new Date(Date.now() - i * 7 * 60_000 - Math.floor(r() * 60_000)).toISOString(),
    actor: actors[i % actors.length],
    action: actions[i % actions.length],
    resource: resources[i % resources.length],
    ip,
    result,
    txHash: i % 3 === 0 ? `${Math.floor(r() * 16 ** 8).toString(16).padStart(8, "0")}${Math.floor(r() * 16 ** 8).toString(16).padStart(8, "0")}` : undefined,
  };
});

// ---------- Formatters ----------
export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRLm = (n: number) => `R$ ${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
export const fmtNum = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtUTC = (iso: string) => new Date(iso).toUTCString().slice(17, 25);
export const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);
