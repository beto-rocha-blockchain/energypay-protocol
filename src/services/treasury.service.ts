/**
 * Treasury service — real data from /api/dashboard/horizon.
 *
 * Replaces the previous hardcoded fake balances (Settlement Pool 184 220 XLM,
 * Clearing Treasury 92 410 XLM, etc.).  Now queries the actual Stellar Horizon
 * balances for the operator account and the EPWR distribution account.
 */

import type { TreasuryBalance } from "@/types/domain";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";
import { API_BASE_URL } from "@/lib/api";

async function fetchLive(): Promise<TreasuryBalance[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/horizon`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Horizon API ${res.status}`);
  const json = await res.json();
  const asOf = json.checked_at ?? nowIso();

  const items: TreasuryBalance[] = [];

  // Operator settlement account
  if (json.operator_balance) {
    const ob = json.operator_balance as { xlm?: string; epwr?: string };
    if (ob.xlm !== undefined) {
      items.push({
        accountId: "operator-settlement",
        label: "Operator Settlement Account",
        assetCode: "XLM",
        balance: parseFloat(ob.xlm),
        asOf,
      });
    }
    if (ob.epwr !== undefined) {
      items.push({
        accountId: "operator-settlement",
        label: "Operator Settlement Account",
        assetCode: "EPWR",
        balance: parseFloat(ob.epwr),
        asOf,
      });
    }
  }

  // Distribution / issuance account
  if (json.distribution_balance) {
    const db = json.distribution_balance as { xlm?: string; epwr?: string };
    if (db.xlm !== undefined) {
      items.push({
        accountId: "epwr-distribution",
        label: "EPWR Distribution Account",
        assetCode: "XLM",
        balance: parseFloat(db.xlm),
        asOf,
      });
    }
    if (db.epwr !== undefined) {
      items.push({
        accountId: "epwr-distribution",
        label: "EPWR Distribution Account",
        assetCode: "EPWR",
        balance: parseFloat(db.epwr),
        asOf,
      });
    }
  }

  return items;
}

export const treasuryService: ReadService<TreasuryBalance, void> = {
  async list() {
    const items = await fetchLive();
    return {
      items,
      total: items.length,
      asOf: nowIso(),
      source: "LIVE",
    } as ListResult<TreasuryBalance>;
  },
  async get(id) {
    const items = await fetchLive();
    return items.find((b) => b.accountId === id) ?? null;
  },
  subscribe(onUpdate, _f, intervalMs = 30_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
