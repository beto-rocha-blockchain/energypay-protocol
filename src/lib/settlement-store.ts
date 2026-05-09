/**
 * Settlement persistence abstraction.
 *
 * Currently in-memory (per-Worker process). The interface is shaped so the
 * implementation can be swapped for PostgreSQL later without touching the
 * adapter or the routes — only the `SettlementStore` impl changes.
 *
 * Persistence is required for:
 *   - retry-safe submission (idempotency by transfer_id)
 *   - audit log of every settlement that reaches Horizon
 *   - telemetry counters (finalized / failed / avg latency)
 */

import type { SettlementState } from "@/lib/settlement-state-machine";

/** Canonical receipt emitted by the adapter once a transfer is finalized. */
export type SettlementReceipt = {
  transfer_id: string;
  tx_hash: string;
  ledger: number;
  sender: string;
  recipient: string;
  asset: "EPWR" | "XLM";
  amount: number;
  memo: string;
  submitted_at: string;     // ISO-8601 — first time tx left the adapter
  finalized_at: string;     // ISO-8601 — Horizon confirmed
  latency_ms: number;       // finalized_at − submitted_at
  explorer_url: string;     // stellar.expert link
  status: SettlementState;  // FINALIZED | FAILED in practice
  error?: string;
};

export interface SettlementStore {
  get(transferId: string): Promise<SettlementReceipt | null>;
  put(receipt: SettlementReceipt): Promise<void>;
  list(limit?: number): Promise<SettlementReceipt[]>;
}

/**
 * In-memory implementation. Lives for the lifetime of the Worker isolate —
 * good enough for testnet operations and fully replaceable by a Postgres
 * implementation backing the same interface.
 */
class InMemorySettlementStore implements SettlementStore {
  private byId = new Map<string, SettlementReceipt>();

  async get(transferId: string) {
    return this.byId.get(transferId) ?? null;
  }

  async put(receipt: SettlementReceipt) {
    this.byId.set(receipt.transfer_id, receipt);
  }

  async list(limit = 100) {
    return Array.from(this.byId.values())
      .sort((a, b) => b.finalized_at.localeCompare(a.finalized_at))
      .slice(0, limit);
  }
}

// Single process-wide instance. When swapping to Postgres, replace this
// export with the PG-backed implementation; nothing else changes.
export const settlementStore: SettlementStore = new InMemorySettlementStore();
