/**
 * Oracle service — real CMO/PLD prices from ONS Open Data.
 *
 * Data flow:  ONS S3 (cmo_semi_horario CSV) → backend /api/oracle/pld → UI
 *
 * signerCount / divergencePct / latencyMs are protocol fields not yet measured
 * by the backend oracle; they remain at safe defaults until the oracle monitoring
 * layer is implemented.
 */

import type { OracleSample } from "@/types/domain";
import type { SubmercadoCode } from "@/lib/terminology";
import { PLD_FEED_ID } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";
import { API_BASE_URL } from "@/lib/api";

/** Map ONS subsistema codes to internal SubmercadoCode */
const ONS_TO_SM: Record<string, SubmercadoCode> = {
  SE: "SE_CO",
  S: "S",
  NE: "NE",
  N: "N",
};

async function fetchLive(): Promise<OracleSample[]> {
  const res = await fetch(`${API_BASE_URL}/api/oracle/pld`);
  if (!res.ok) throw new Error(`Oracle API ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.prices)) return [];

  return (json.prices as Array<{
    subsistema: string;
    cmo_brl_mwh: number;
    timestamp: string;
  }>).map((p, i) => ({
    feedId: PLD_FEED_ID(ONS_TO_SM[p.subsistema] ?? (p.subsistema as SubmercadoCode)),
    submercado: ONS_TO_SM[p.subsistema] ?? (p.subsistema as SubmercadoCode),
    observedAt: p.timestamp,
    priceBRLPerMWh: p.cmo_brl_mwh,
    signerCount: 4,
    divergencePct: 0,
    latencyMs: 0,
    source: "CCEE_PRIMARY" as const,
  }));
}

export const oracleService: ReadService<OracleSample, void> = {
  async list() {
    const items = await fetchLive();
    return {
      items,
      total: items.length,
      asOf: nowIso(),
      source: "ONS",
    } as ListResult<OracleSample>;
  },
  async get(id) {
    const items = await fetchLive();
    return items.find((s) => s.feedId === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 60_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
