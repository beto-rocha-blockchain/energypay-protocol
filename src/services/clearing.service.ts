/**
 * Clearing service — real data from /api/dashboard/contracts.
 *
 * Replaces the previous mock generator that produced 12 synthetic bilateral
 * contracts.  Each contract row comes from the Supabase contracts table,
 * normalised into the BilateralContract shape used by the institutional UI.
 */

import type { BilateralContract } from "@/types/domain";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";
import { API_BASE_URL } from "@/lib/api";

async function fetchLive(): Promise<BilateralContract[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/contracts`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Contracts API ${res.status}`);
  const json = await res.json();
  if (!json.success) return [];

  return (json.contracts as Array<{
    id: string;
    buyer_id?: string;
    seller_id?: string;
    buyer?: string;
    seller?: string;
    submercado?: string;
    notional_brl?: number;
    volume_mwh?: number;
    price_brl_per_mwh?: number;
    start_at?: string;
    end_at?: string;
    settlement_date?: string;
    status?: string;
    delivered_mwh?: number;
    margin_posted_brl?: number;
    mtm_brl?: number;
    created_at?: string;
  }>).map((c) => {
    const status = (c.status ?? "ACTIVE") as BilateralContract["status"];
    const rawSub = c.submercado ?? "SE_CO";
    const sub = (rawSub === "SE/CO" ? "SE_CO" : rawSub) as BilateralContract["submercado"];
    return {
      id: c.id,
      buyerId: c.buyer_id ?? c.buyer ?? "—",
      sellerId: c.seller_id ?? c.seller ?? "—",
      buyerName: c.buyer ?? "—",
      sellerName: c.seller ?? "—",
      submercado: sub,
      notionalBRL: Number(c.notional_brl ?? 0),
      volumeMWh: Number(c.volume_mwh ?? 0),
      priceBRLPerMWh: Number(c.price_brl_per_mwh ?? 0),
      startAt: c.start_at ?? c.created_at ?? nowIso(),
      endAt: c.end_at ?? c.settlement_date ?? nowIso(),
      status: ["DELIVERING", "PENDING_APPROVAL", "ACTIVE", "SETTLED", "FAILED", "DRAFT"].includes(
        status,
      )
        ? status
        : "ACTIVE",
      deliveredMWh: Number(c.delivered_mwh ?? 0),
      marginPostedBRL: Number(c.margin_posted_brl ?? 0),
      mtmBRL: Number(c.mtm_brl ?? 0),
    } satisfies BilateralContract;
  });
}

export const clearingService: ReadService<BilateralContract, void> = {
  async list(): Promise<ListResult<BilateralContract>> {
    const items = await fetchLive();
    return { items, total: items.length, asOf: nowIso(), source: "LIVE" };
  },
  async get(id) {
    const items = await fetchLive();
    return items.find((c) => c.id === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 20_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
