/**
 * Settlements service — real data from /api/dashboard/settlements.
 *
 * Replaces the previous mock generator that produced 24 synthetic events.
 * Each settlement row comes directly from the Supabase settlements table,
 * normalised into the SettlementEvent shape used by the institutional UI.
 */

import type { SettlementEvent } from "@/types/domain";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";
import { API_BASE_URL } from "@/lib/api";

async function fetchLive(): Promise<SettlementEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/settlements?limit=50`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Settlements API ${res.status}`);
  const json = await res.json();
  if (!json.success) return [];

  return (json.settlements as Array<{
    id: string;
    contract_id?: string;
    buyer?: string;
    seller?: string;
    amount_brl?: number;
    volume_mwh?: number;
    pld?: number;
    tx_hash?: string;
    ledger?: number;
    status?: string;
    created_at?: string;
  }>).map((s) => {
    const status = (s.status ?? "SETTLED").toUpperCase();
    const lifecycle =
      status === "CONFIRMED" || status === "SETTLED"
        ? "SETTLED"
        : status === "FAILED"
          ? "REJECTED"
          : status === "PENDING"
            ? "VALIDATED"
            : status === "BROADCASTING"
              ? "ANCHORED"
              : ("INTAKE" as SettlementEvent["lifecycle"]);

    return {
      id: s.id,
      correlationId: s.id,
      contractId: s.contract_id ?? "—",
      counterpartyId: s.buyer ?? s.seller ?? "—",
      lifecycle,
      severity: lifecycle === "REJECTED" ? "CRITICAL" : lifecycle === "ANCHORED" ? "ELEVATED" : "NOMINAL",
      notionalBRL: Number(s.amount_brl ?? 0),
      volumeMWh: Number(s.volume_mwh ?? 0),
      txHash: s.tx_hash ?? "",
      ledgerSeq: Number(s.ledger ?? 0),
      submittedAt: s.created_at ?? nowIso(),
      latencyMs: 0,
      channel: "BILATERAL" as const,
      retries: 0,
    } satisfies SettlementEvent;
  });
}

export const settlementsService: ReadService<SettlementEvent, void> = {
  async list(): Promise<ListResult<SettlementEvent>> {
    const items = await fetchLive();
    return { items, total: items.length, asOf: nowIso(), source: "LIVE" };
  },
  async get(id) {
    const items = await fetchLive();
    return items.find((s) => s.id === id) ?? null;
  },
  subscribe(onUpdate, _filter, intervalMs = 15_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
