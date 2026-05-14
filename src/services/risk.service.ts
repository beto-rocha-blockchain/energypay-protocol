import { COUNTERPARTIES } from "@/lib/institutional-data";
import type { RiskExposure } from "@/types/domain";
import { computeExposure } from "@/lib/formatters";
import { toSeverity } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): RiskExposure[] {
  const asOf = new Date().toISOString();
  return COUNTERPARTIES.map((cp) => {
    const mtm = (cp.exposureBRL * (cp.collateralRatio - 1)) * 0.18;
    const e = computeExposure({
      notional: cp.exposureBRL,
      mtm,
      margin: cp.collateralBRL,
      haircut: cp.rating === "AAA" || cp.rating === "AA" ? 0.03 : cp.rating === "A" ? 0.08 : 0.15,
    });
    const severity =
      e.coverageRatio < 0.95 ? "CRITICAL" :
      e.coverageRatio < 1.05 ? "DEGRADED" :
      e.coverageRatio < 1.20 ? "ELEVATED" : "NOMINAL";
    return {
      counterpartyId: cp.id,
      counterpartyName: cp.shortName,
      grossBRL: e.gross,
      netBRL: e.net,
      collateralBRL: e.collateralized,
      uncoveredBRL: e.uncovered,
      coverageRatio: e.coverageRatio,
      defaultProbBps: cp.defaultProbBps,
      ratingPenaltyBps:
        cp.rating === "AAA" ? 0 : cp.rating === "AA" ? 8 : cp.rating === "A" ? 22 : 65,
      severity: toSeverity(severity),
      asOf,
    } satisfies RiskExposure;
  });
}

export const riskService: ReadService<RiskExposure, void> = {
  async list() {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" } as ListResult<RiskExposure>;
  },
  async get(id) {
    return generate().find((r) => r.counterpartyId === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 18_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
