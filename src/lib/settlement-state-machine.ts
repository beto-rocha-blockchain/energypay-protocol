/**
 * Unified settlement state machine — shared between frontend UI and the
 * backend settlement adapter. This is the canonical lifecycle for every
 * Stellar transfer that flows through the EnergyPay rail.
 *
 *   IDLE
 *     ↓
 *   PREPARING        — payload normalized + idempotency check
 *     ↓
 *   SIGNING          — backend custody signs the tx in-memory
 *     ↓
 *   BROADCASTING     — submitTransaction() sent to Horizon
 *     ↓
 *   PENDING_CONFIRMATION
 *     ↓
 *   CONFIRMED        — Horizon returned hash + ledger
 *     ↓
 *   FINALIZED        — operation result reconciled, receipt persisted
 *
 *   FAILED           — terminal error, reachable from any non-terminal state
 *
 * The state machine is intentionally pure: no IO, no side-effects. The
 * adapter and the UI both consume `transition()` to move forward.
 */

export const SETTLEMENT_STATES = [
  "IDLE",
  "PREPARING",
  "SIGNING",
  "BROADCASTING",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "FINALIZED",
  "FAILED",
] as const;

export type SettlementState = (typeof SETTLEMENT_STATES)[number];

const TRANSITIONS: Record<SettlementState, SettlementState[]> = {
  IDLE: ["PREPARING", "FAILED"],
  PREPARING: ["SIGNING", "FAILED"],
  SIGNING: ["BROADCASTING", "FAILED"],
  BROADCASTING: ["PENDING_CONFIRMATION", "FAILED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "FAILED"],
  CONFIRMED: ["FINALIZED", "FAILED"],
  FINALIZED: [],
  FAILED: [],
};

export const canTransition = (
  from: SettlementState,
  to: SettlementState,
): boolean => TRANSITIONS[from]?.includes(to) ?? false;

export const transition = (
  from: SettlementState,
  to: SettlementState,
): SettlementState => {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal settlement transition: ${from} → ${to}`);
  }
  return to;
};

export const isTerminal = (s: SettlementState): boolean =>
  s === "FINALIZED" || s === "FAILED";
