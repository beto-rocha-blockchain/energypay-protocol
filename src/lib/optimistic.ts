/**
 * Optimistic update helpers — prepare for real mutations.
 *
 * Pattern:
 *   const undo = applyOptimistic(qc, qk.contracts.list(), (prev) => ...);
 *   try { await mutate(); } catch { undo(); }
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export function applyOptimistic<T>(
  qc: QueryClient,
  key: QueryKey,
  updater: (prev: T | undefined) => T,
): () => void {
  const prev = qc.getQueryData<T>(key);
  qc.setQueryData<T>(key, (curr) => updater(curr as T | undefined));
  return () => qc.setQueryData<T>(key, prev);
}

export function withCorrelationId<T extends Record<string, unknown>>(
  payload: T,
): T & { correlationId: string } {
  const cid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `corr_${Math.random().toString(36).slice(2, 10)}`;
  return { ...payload, correlationId: cid };
}
