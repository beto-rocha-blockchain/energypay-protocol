import { COUNTERPARTIES } from "@/lib/institutional-data";
import type { BilateralContract } from "@/types/domain";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): BilateralContract[] {
  return Array.from({ length: 12 }).map((_, i) => {
    const buyer = COUNTERPARTIES[(i * 3) % COUNTERPARTIES.length];
    const seller = COUNTERPARTIES[(i * 5 + 1) % COUNTERPARTIES.length];
    const price = 220 + (i * 13) % 80;
    const volume = 800 + (i * 71) % 6400;
    const notional = price * volume;
    const startAt = new Date(Date.now() - i * 86_400_000).toISOString();
    const endAt = new Date(Date.now() + (180 - i * 7) * 86_400_000).toISOString();
    const delivered = Math.round(volume * (0.18 + ((i * 41) % 78) / 100));
    return {
      id: `EPC-${2058 + i}`,
      buyerId: buyer.id,
      sellerId: seller.id,
      buyerName: buyer.shortName,
      sellerName: seller.shortName,
      submercado: buyer.submercado === "SE/CO" ? "SE_CO" : (buyer.submercado as "S" | "NE" | "N"),
      notionalBRL: notional,
      volumeMWh: volume,
      priceBRLPerMWh: price,
      startAt,
      endAt,
      status: i === 0 ? "DELIVERING" : i % 5 === 0 ? "PENDING_APPROVAL" : "ACTIVE",
      deliveredMWh: delivered,
      marginPostedBRL: Math.round(notional * 0.18),
      mtmBRL: Math.round((i % 2 === 0 ? 1 : -1) * notional * 0.012),
    } satisfies BilateralContract;
  });
}

export const clearingService: ReadService<BilateralContract, void> = {
  async list(): Promise<ListResult<BilateralContract>> {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" };
  },
  async get(id) {
    return generate().find((c) => c.id === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 20_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
