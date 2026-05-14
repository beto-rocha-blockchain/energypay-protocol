/**
 * Server-side settlement telemetry counters. Aggregates latency and outcome
 * across the lifetime of the adapter's Worker isolate. Cheap to read,
 * intentionally lock-free — single-isolate Worker is effectively
 * single-threaded for these counters.
 */

export type SettlementTelemetry = {
  finalized_count: number;
  failed_count: number;
  total_latency_ms: number;     // cumulative end-to-end finality
  total_horizon_ms: number;     // cumulative time spent waiting on Horizon
  horizon_samples: number;
  last_updated_at: string | null;
};

const counters: SettlementTelemetry = {
  finalized_count: 0,
  failed_count: 0,
  total_latency_ms: 0,
  total_horizon_ms: 0,
  horizon_samples: 0,
  last_updated_at: null,
};

export const recordFinalized = (latencyMs: number, horizonMs: number) => {
  counters.finalized_count += 1;
  counters.total_latency_ms += Math.max(0, latencyMs);
  counters.total_horizon_ms += Math.max(0, horizonMs);
  counters.horizon_samples += 1;
  counters.last_updated_at = new Date().toISOString();
};

export const recordFailed = (horizonMs: number) => {
  counters.failed_count += 1;
  if (horizonMs > 0) {
    counters.total_horizon_ms += horizonMs;
    counters.horizon_samples += 1;
  }
  counters.last_updated_at = new Date().toISOString();
};

export const snapshot = () => {
  const avgFinality =
    counters.finalized_count > 0
      ? Math.round(counters.total_latency_ms / counters.finalized_count)
      : 0;
  const avgHorizon =
    counters.horizon_samples > 0
      ? Math.round(counters.total_horizon_ms / counters.horizon_samples)
      : 0;
  return {
    finalized_count: counters.finalized_count,
    failed_count: counters.failed_count,
    avg_finality_ms: avgFinality,
    avg_horizon_ms: avgHorizon,
    last_updated_at: counters.last_updated_at,
  };
};
