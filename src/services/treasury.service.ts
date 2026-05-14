import type { TreasuryBalance } from "@/types/domain";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

function generate(): TreasuryBalance[] {
  const asOf = new Date().toISOString();
  return [
    { accountId: "settlement-pool", label: "Settlement Guarantee Pool", assetCode: "XLM", balance: 184_220.42, reservedBalance: 12_000, asOf },
    { accountId: "settlement-pool", label: "Settlement Guarantee Pool", assetCode: "EPWR", assetIssuer: "GA...", balance: 1_482_900, reservedBalance: 220_000, trustlineLimit: 5_000_000, asOf },
    { accountId: "clearing-treasury", label: "Clearing Treasury", assetCode: "XLM", balance: 92_410.18, asOf },
    { accountId: "clearing-treasury", label: "Clearing Treasury", assetCode: "EPWR", assetIssuer: "GA...", balance: 612_440, asOf },
    { accountId: "fee-collection", label: "Fee Collection", assetCode: "XLM", balance: 18_402.71, asOf },
  ];
}

export const treasuryService: ReadService<TreasuryBalance, void> = {
  async list() {
    const items = generate();
    return { items, total: items.length, asOf: nowIso(), source: "MOCK" } as ListResult<TreasuryBalance>;
  },
  async get(id) {
    return generate().find((b) => b.accountId === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 15_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
