import { COUNTERPARTIES, fmtUTC } from "@/lib/institutional-data";
import type { SettlementEvent } from "@/types/domain";
import type { LifecycleState } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

const lifeStates: LifecycleState[] = [
  "INTAKE", "VALIDATED", "MATCHED", "ANCHORED", "CLEARED", "SETTLED",
  "ANCHORED", "CLEARED", "SETTLED", "SETTLED", "REJECTED",
];

function generate(): SettlementEvent[] {
  const now = Date.now();
  return Array.from({ length: 24 }).map((_, i) => {
    const cp = COUNTERPARTIES[i % COUNTERPARTIES.length];
    const lifecycle = lifeStates[i % lifeStates.length];
    const submittedAt = new Date(now - i * 47_000 - (i % 7) * 1100).toISOString();
    const anchorMs = 4200 + ((i * 97) % 2400);
    const ledger = 51_224_197 - i;
    const hashBytes = Array.from({ length: 16 }, (_, k) =>
      ((i * 211 + k * 17) % 256).toString(16).padStart(2, "0"),
    ).join("");
    return {
      id: `SE-${String(900_421 + i).padStart(6, "0")}`,
      correlationId: `corr_${(i * 9301 + 49297).toString(36)}`,
      contractId: `EPC-${2058 + (i % 32)}`,
      counterpartyId: cp.id,
      lifecycle,
      severity:
        lifecycle === "REJECTED" ? "CRITICAL" :
        lifecycle === "ANCHORED" ? "ELEVATED" : "NOMINAL",
      notionalBRL: Math.round((90_000 + (i * 911) % 540_000) / 10) * 10,
      volumeMWh: Math.round(((i * 13) % 240) + 4),
      txHash: hashBytes,
      ledgerSeq: ledger,
      submittedAt,
      anchoredAt: lifecycle !== "INTAKE" && lifecycle !== "VALIDATED"
        ? new Date(new Date(submittedAt).getTime() + anchorMs).toISOString() : undefined,
      clearedAt: ["CLEARED", "SETTLED"].includes(lifecycle)
        ? new Date(new Date(submittedAt).getTime() + anchorMs + 950).toISOString() : undefined,
      settledAt: lifecycle === "SETTLED"
        ? new Date(new Date(submittedAt).getTime() + anchorMs + 1400).toISOString() : undefined,
      rejectedAt: lifecycle === "REJECTED"
        ? new Date(new Date(submittedAt).getTime() + 280).toISOString() : undefined,
      latencyMs: anchorMs + ((i * 7) % 800),
      channel: (["BILATERAL", "POOL", "P2P", "OTC"] as const)[i % 4],
      failureCode: lifecycle === "REJECTED" ? "E_MATCH_TOLERANCE" : undefined,
      failureReason: lifecycle === "REJECTED" ? "Price tolerance exceeded against PLD reference (Δ > 1.20%)" : undefined,
      retries: lifecycle === "REJECTED" ? 1 + (i % 2) : 0,
    } satisfies SettlementEvent;
  });
}

void fmtUTC; // keep import warm

export const settlementsService: ReadService<SettlementEvent, void> = {
  async list(): Promise<ListResult<SettlementEvent>> {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" };
  },
  async get(id) {
    return generate().find((s) => s.id === id) ?? null;
  },
  subscribe(onUpdate, _filter, intervalMs = 12_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
