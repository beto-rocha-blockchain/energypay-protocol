import { AUDIT_LOG } from "@/lib/institutional-data";
import type { AuditEvent } from "@/types/domain";
import type { AuditAction } from "@/lib/terminology";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): AuditEvent[] {
  return AUDIT_LOG.map((a, i) => {
    const action = (a.action as AuditAction);
    return {
      id: a.id,
      ts: a.ts,
      actor: a.actor,
      operatorId: `OP-${7700 + (i % 60)}`,
      sessionId: `sess_${(i * 31337).toString(36)}`,
      ipMasked: a.ip.replace(/\.\d+$/, ".xxx"),
      correlationId: `corr_${(i * 7331 + 17).toString(36)}`,
      parentEventId: i > 0 && i % 4 === 0 ? AUDIT_LOG[i - 1].id : undefined,
      action,
      resource: a.resource,
      result: a.result,
      severity: a.result === "OK" ? "NOMINAL" : a.result === "DENIED" ? "ELEVATED" : "CRITICAL",
      txHash: a.txHash,
      ledgerSeq: a.txHash ? 51_224_197 - i : undefined,
      details: undefined,
    } satisfies AuditEvent;
  });
}

export const auditService: ReadService<AuditEvent, void> = {
  async list() {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" } as ListResult<AuditEvent>;
  },
  async get(id) {
    return generate().find((a) => a.id === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 14_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
