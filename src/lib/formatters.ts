/**
 * EnergyPay institutional formatters.
 * Single rendering boundary — domain layer must keep raw values (ISO,
 * numeric); only format at the JSX render site.
 */

export const fmtBRL = (n: number, opts?: { compact?: boolean }) => {
  if (opts?.compact) {
    if (Math.abs(n) >= 1e9) return `R$ ${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toFixed(1)}k`;
  }
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
};

export const fmtMWh = (n: number) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })} MWh`;

export const fmtMW = (n: number) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })} MW`;

export const fmtEPWR = (n: number) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EPWR`;

export const fmtPct = (n: number, d = 1) =>
  `${n >= 0 ? "" : ""}${n.toFixed(d)}%`;

export const fmtNum = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

export const fmtBps = (n: number) => `${n.toFixed(0)} bps`;

// ─── Time / timestamps ───────────────────────────────────────────────
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** YYYY-MM-DD HH:mm:ss UTC */
export const fmtUtc = (iso: string | number | Date): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};

/** HH:mm:ss.SSS — for telemetry tickers */
export const fmtTimeMs = (iso: string | number | Date): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(
    d.getUTCMilliseconds(),
    3,
  )}`;
};

/** Relative age in operational shorthand: 12s, 4m, 2h, 1d */
export const fmtAge = (iso: string | number | Date): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** Latency display: 124ms / 1.42s / 12.4s */
export const fmtLatency = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(1)} m`;
};

// ─── Ledger / hash rendering ─────────────────────────────────────────
/** Stellar ledger sequence: #00 051 224 197 */
export const fmtLedger = (seq: number | string): string => {
  const n = typeof seq === "string" ? Number(seq) : seq;
  if (!Number.isFinite(n)) return "—";
  return `#${n.toLocaleString("en-US").replace(/,/g, " ")}`;
};

/** Tx hash: 6 + 4 ellipsis, monospace upper */
export const fmtTxHash = (hash: string | undefined | null): string => {
  if (!hash) return "—";
  const h = hash.trim();
  if (h.length <= 12) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
};

/** Stellar Expert URL builder */
export const stellarExpertUrl = (
  hashOrAccount: string,
  kind: "tx" | "account" | "ledger" | "asset" = "tx",
  network: "public" | "testnet" = "testnet",
): string => {
  const base = `https://stellar.expert/explorer/${network}`;
  switch (kind) {
    case "tx":
      return `${base}/tx/${hashOrAccount}`;
    case "account":
      return `${base}/account/${hashOrAccount}`;
    case "ledger":
      return `${base}/ledger/${hashOrAccount}`;
    case "asset":
      return `${base}/asset/${hashOrAccount}`;
  }
};

// ─── Exposure / risk ─────────────────────────────────────────────────
export const computeExposure = (input: {
  notional: number;
  mtm?: number;
  margin?: number;
  haircut?: number;
}): {
  gross: number;
  net: number;
  collateralized: number;
  uncovered: number;
  coverageRatio: number;
} => {
  const gross = Math.max(0, input.notional);
  const mtm = input.mtm ?? 0;
  const margin = input.margin ?? 0;
  const haircut = Math.min(1, Math.max(0, input.haircut ?? 0));
  const net = gross + mtm;
  const collateralized = Math.max(0, margin * (1 - haircut));
  const uncovered = Math.max(0, net - collateralized);
  const coverageRatio = net > 0 ? collateralized / net : 1;
  return { gross, net, collateralized, uncovered, coverageRatio };
};

// ─── Identifier formatters ───────────────────────────────────────────
export const fmtOperatorId = (id: string) => id.toUpperCase();
export const fmtContractId = (id: string) =>
  id.startsWith("EPC-") ? id : `EPC-${id}`;
export const fmtCorrelationId = (id: string) =>
  id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
