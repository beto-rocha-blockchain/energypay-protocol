/**
 * Operational log for the settlement rail. Captures auth, validation,
 * signing, Horizon submission, and ledger confirmation events. Stored in
 * a bounded ring buffer so the institutional terminal can pull a recent
 * audit trail via /api/settlements/telemetry.
 */

export type OpsStage =
  | "auth"
  | "validation"
  | "signing"
  | "horizon"
  | "confirmation"
  | "idempotency";

export type OpsLogLevel = "info" | "warn" | "error";

export type OpsLogEntry = {
  ts: string;
  stage: OpsStage;
  level: OpsLogLevel;
  message: string;
  meta?: Record<string, unknown>;
};

const MAX_ENTRIES = 500;
const buffer: OpsLogEntry[] = [];

export const opsLog = (
  stage: OpsStage,
  message: string,
  meta?: Record<string, unknown>,
  level: OpsLogLevel = "info",
) => {
  const entry: OpsLogEntry = {
    ts: new Date().toISOString(),
    stage,
    level,
    message,
    meta,
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  // Mirror to stdout so platform logs capture the trail.
  const line = `[settlement][${stage}] ${message}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.log(line, meta ?? "");
};

export const opsTail = (limit = 100): OpsLogEntry[] =>
  buffer.slice(-Math.max(1, Math.min(limit, MAX_ENTRIES)));
