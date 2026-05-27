/**
 * Oracle routes — Real-time CMO/PLD data from ONS Open Data.
 *
 * GET /api/oracle/pld
 *   Returns the latest CMO (Custo Marginal de Operação) prices per
 *   subsistema from the ONS public dataset. CMO is the operational
 *   basis for PLD pricing in the Brazilian energy market.
 *
 * GET /api/oracle/pld/history?hours=48
 *   Returns semi-hourly CMO history for chart rendering.
 *
 * Data source: https://dados.ons.org.br/dataset/cmo-semi-horario
 * Updated daily at 12:00 and 19:00 BRT by ONS.
 */

import express from "express";

const router = express.Router();

const ONS_BASE = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm";

/** Per-year in-memory cache to avoid hammering ONS on every request. */
const yearCache = {}; // { [year]: { data, fetchedAt } }

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch and parse the CMO CSV for the given year.
 * The file is semicolon-delimited with columns:
 *   id_subsistema;nom_subsistema;din_instante;val_cmo
 *
 * A 30-second AbortController timeout prevents the request from hanging
 * indefinitely when ONS S3 is slow (annual CSVs can be 3–5 MB each).
 */
async function fetchCmoData(year) {
  const url = `${ONS_BASE}/CMO_SEMIHORARIO_${year}.csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`ONS returned HTTP ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n");
  // skip header
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 4) continue;
    rows.push({
      subsistema: parts[0].trim(),
      nome: parts[1].trim(),
      timestamp: parts[2].trim(),
      cmo: parseFloat(parts[3].trim()),
    });
  }
  return rows;
}

/** Get cached rows for a single year */
async function getCacheForYear(year) {
  const now = Date.now();
  const entry = yearCache[year];
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) return entry.data;

  try {
    const rows = await fetchCmoData(year);
    yearCache[year] = { data: rows, fetchedAt: now };
    return rows;
  } catch (err) {
    if (entry) return entry.data; // stale is better than nothing
    return []; // year doesn't exist on ONS
  }
}

/** Get current year data (default for most endpoints) */
async function getCache() {
  return getCacheForYear(new Date().getFullYear());
}

/** Get data spanning current + previous year */
async function getMultiYearCache() {
  const year = new Date().getFullYear();
  const [prev, curr] = await Promise.all([
    getCacheForYear(year - 1),
    getCacheForYear(year),
  ]);
  return [...prev, ...curr];
}

/**
 * ONS timestamps are in BRT (UTC-3) — e.g. "2026-05-27 20:30:00" means
 * 20:30 Brasília time. JS Date.toISOString() always returns UTC, so
 * direct string comparison would be off by 3 hours.
 *
 * toBrtCutoff() takes an absolute millisecond epoch, subtracts the BRT
 * offset, then formats as a "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD" string
 * that can be safely compared against ONS timestamps.
 */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3

function toBrtCutoff(epochMs, dateOnly = false) {
  const brt = new Date(epochMs - BRT_OFFSET_MS);
  const iso = brt.toISOString();
  return dateOnly ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
}

/** Map ONS subsistema codes to EnergyPay submercado labels */
const SUBSISTEMA_MAP = {
  SE: "SE/CO",
  S: "S",
  NE: "NE",
  N: "N",
};

/**
 * GET /api/oracle/pld
 * Returns the latest CMO price per subsistema.
 */
router.get("/pld", async (_req, res) => {
  try {
    const rows = await getCache();

    // Find the latest timestamp across all subsystems (ONS CSV is ordered by
    // timestamp, but we reduce to be safe against interleaved subsystem rows).
    const latestTs = rows.reduce((max, r) => (r.timestamp > max ? r.timestamp : max), "");
    if (!latestTs) {
      return res.json({ success: true, prices: [], source: "ONS", updated_at: null });
    }

    // Get all rows for the latest timestamp
    const latest = rows.filter((r) => r.timestamp === latestTs);

    const prices = latest.map((r) => ({
      submercado: SUBSISTEMA_MAP[r.subsistema] || r.subsistema,
      subsistema: r.subsistema,
      nome: r.nome,
      cmo_brl_mwh: r.cmo,
      timestamp: r.timestamp,
    }));

    return res.json({
      success: true,
      source: "ONS — Custo Marginal de Operação",
      dataset: "cmo_semi_horario",
      updated_at: latestTs,
      prices,
    });
  } catch (err) {
    console.error("[oracle/pld]", err.message);
    return res.status(502).json({
      success: false,
      error: "Failed to fetch PLD data from ONS",
      detail: err.message,
    });
  }
});

/**
 * GET /api/oracle/pld/history?range=48h|7d|1m|12m|1y
 * Returns CMO history aggregated by the chosen range.
 *   48h  → semi-hourly points (default, last 48 h)
 *   7d   → daily averages for the last 7 days
 *   1m   → daily averages for the previous complete calendar month
 *   12m  → [alias for 1m — kept for backward compat]
 *   1y   → monthly averages for the rolling last 12 months
 * Legacy: ?hours=N still works (mapped to semi-hourly).
 */
router.get("/pld/history", async (req, res) => {
  try {
    const range = req.query.range || null;

    let series;

    if (range === "7d") {
      // Daily averages — last 7 days.
      // Cutoff in BRT for correct string comparison against ONS timestamps.
      // Uses multi-year cache only when the window crosses a year boundary (early January).
      const cutoffStr = toBrtCutoff(Date.now() - 7 * 24 * 3600_000, true);
      const cutoffYear = parseInt(cutoffStr.slice(0, 4));
      const rows = cutoffYear < new Date().getFullYear()
        ? await getMultiYearCache()
        : await getCache();
      const filtered = rows.filter((r) => r.timestamp.slice(0, 10) >= cutoffStr);
      series = aggregateBy(filtered, (r) => r.timestamp.slice(0, 10));

    } else if (range === "1m" || range === "12m") {
      // Daily averages — current calendar month (day 1 → today).
      const rows = await getCache();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const filtered = rows.filter((r) => r.timestamp.slice(0, 10) >= monthStart);
      series = aggregateBy(filtered, (r) => r.timestamp.slice(0, 10));

    } else if (range === "1y") {
      // Monthly averages — rolling last 12 months.
      // e.g. if today is May/2026, returns Jun/2025 → May/2026 (12 data points).
      const now = new Date();
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}`;
      const allRows = await getMultiYearCache();
      const filtered = allRows.filter((r) => r.timestamp.slice(0, 7) >= cutoffStr);
      series = aggregateBy(filtered, (r) => r.timestamp.slice(0, 7));

    } else {
      // Semi-hourly (default) — last N hours.
      // Cutoff expressed in BRT so the comparison against ONS timestamps is correct.
      const rows = await getCache();
      const hours = Math.min(168, Math.max(1, parseInt(req.query.hours) || 48));
      const cutoffStr = toBrtCutoff(Date.now() - hours * 3600_000);
      const filtered = rows.filter((r) => r.timestamp >= cutoffStr);

      const grouped = {};
      for (const r of filtered) {
        if (!grouped[r.timestamp]) grouped[r.timestamp] = { t: r.timestamp };
        grouped[r.timestamp][r.subsistema] = r.cmo;
      }
      series = Object.values(grouped).sort((a, b) => a.t.localeCompare(b.t));
    }

    return res.json({
      success: true,
      source: "ONS — Custo Marginal de Operação",
      range: range || "48h",
      points: series.length,
      series,
    });
  } catch (err) {
    console.error("[oracle/pld/history]", err.message);
    return res.status(502).json({
      success: false,
      error: "Failed to fetch PLD history from ONS",
      detail: err.message,
    });
  }
});

/**
 * Aggregate rows by a key function, averaging CMO per subsistema.
 */
function aggregateBy(rows, keyFn) {
  const buckets = {};
  for (const r of rows) {
    const key = keyFn(r);
    if (!buckets[key]) buckets[key] = {};
    if (!buckets[key][r.subsistema]) buckets[key][r.subsistema] = { sum: 0, count: 0 };
    buckets[key][r.subsistema].sum += r.cmo;
    buckets[key][r.subsistema].count += 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, subs]) => {
      const point = { t: key };
      for (const [sub, { sum, count }] of Object.entries(subs)) {
        point[sub] = Math.round((sum / count) * 100) / 100;
      }
      return point;
    });
}

/**
 * Pre-warm the multi-year cache on startup so the ANO chart renders
 * instantly on first user request instead of blocking for ~30 s while
 * the previous-year CSV downloads from ONS S3.
 *
 * Runs 3 seconds after module load (gives the server time to fully bind).
 * Errors are silently swallowed — getCacheForYear already handles them.
 */
setTimeout(() => {
  getMultiYearCache().catch(() => {});
}, 3_000);

export default router;
