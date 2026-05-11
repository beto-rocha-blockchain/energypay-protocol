import { buildPldSeries } from "@/lib/institutional-data";
import type { OracleSample } from "@/types/domain";
import type { SubmercadoCode } from "@/lib/terminology";
import { PLD_FEED_ID } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): OracleSample[] {
  const series = buildPldSeries(1);
  const point = series[series.length - 1];
  const map: Record<SubmercadoCode, number> = {
    SE_CO: point.SECO, S: point.S, NE: point.NE, N: point.N,
  };
  return (Object.keys(map) as SubmercadoCode[]).map((sm, i) => ({
    feedId: PLD_FEED_ID(sm),
    submercado: sm,
    observedAt: point.t,
    priceBRLPerMWh: map[sm],
    signerCount: 4 + (i % 2),
    divergencePct: Math.round((Math.sin(i) * 0.6 + 0.4) * 100) / 100,
    latencyMs: 820 + i * 140,
    source: i === 3 ? "FALLBACK_AGGREGATE" : i === 2 ? "CCEE_SECONDARY" : "CCEE_PRIMARY",
  }));
}

export const oracleService: ReadService<OracleSample, void> = {
  async list() {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" } as ListResult<OracleSample>;
  },
  async get(id) {
    return generate().find((s) => s.feedId === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 10_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
