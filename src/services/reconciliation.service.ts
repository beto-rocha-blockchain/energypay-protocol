import { RECON_EXCEPTIONS, COUNTERPARTIES } from "@/lib/institutional-data";
import type { ReconciliationRow } from "@/types/domain";
import { toSeverity } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): ReconciliationRow[] {
  return RECON_EXCEPTIONS.map((x, i) => {
    const cp = COUNTERPARTIES.find((c) => c.shortName === x.counterparty) ?? COUNTERPARTIES[i % COUNTERPARTIES.length];
    return {
      id: x.id,
      counterpartyId: cp.id,
      counterpartyName: cp.shortName,
      kind: x.kind === "PRICE_MISMATCH" ? "PRICE_MISMATCH" :
            x.kind === "VOLUME_DRIFT"  ? "VOLUME_DRIFT" :
            x.kind === "ORACLE_DIVERGENCE" ? "ORACLE_DIVERGENCE" :
            x.kind === "LEDGER_GAP" ? "LEDGER_GAP" : "TIMESTAMP_SKEW",
      severity: toSeverity(x.severity),
      state: x.state,
      mismatchDelta: x.delta,
      tolerance:
        x.kind === "PRICE_MISMATCH" ? "± R$ 2.50/MWh" :
        x.kind === "VOLUME_DRIFT"  ? "± 0.50 MWh" :
        x.kind === "ORACLE_DIVERGENCE" ? "± 0.75%" :
        x.kind === "LEDGER_GAP" ? "seq ±0" : "± 250 ms",
      retryCount: (i * 7) % 4,
      fallbackChannel:
        x.kind === "ORACLE_DIVERGENCE" ? "ORACLE_SECONDARY" :
        x.kind === "LEDGER_GAP" ? "REPLAY" :
        x.severity === "CRITICAL" ? "MANUAL_REVIEW" : "NONE",
      oracleSignerCount: x.kind === "ORACLE_DIVERGENCE" ? 3 + (i % 3) : undefined,
      openedAt: x.openedAt,
      ageMin: x.ageMin,
      assignedTo: x.state === "INVESTIGATING" ? ["ops.cardoso", "ops.menezes", "compliance.silva"][i % 3] : undefined,
      correlationId: `corr_${(i * 7331 + 17).toString(36)}`,
    } satisfies ReconciliationRow;
  });
}

export const reconciliationService: ReadService<ReconciliationRow, void> = {
  async list() {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" } as ListResult<ReconciliationRow>;
  },
  async get(id) {
    return generate().find((r) => r.id === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 15_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
