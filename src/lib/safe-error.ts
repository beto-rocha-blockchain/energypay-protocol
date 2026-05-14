/**
 * Map backend errors to safe, user-friendly messages.
 * Avoids leaking stack traces, internal URLs, or SDK details to end users.
 */
import type { ApiError } from "@/lib/api";

const INTERNAL_PATTERNS = [
  /https?:\/\//i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /at\s+\w+\s*\(/i, // stack frames
  /node_modules/i,
  /stellar-sdk/i,
  /\bECONN/i,
  /\bENOTFOUND/i,
  /\battr(ibute)?\b.*\bundefined\b/i,
];

const looksInternal = (msg: string) =>
  INTERNAL_PATTERNS.some((rx) => rx.test(msg)) || msg.length > 240;

/**
 * Returns a message safe to render in the UI. Server (5xx) and network
 * errors collapse to a generic string. Validation / auth errors keep their
 * concise message when it does not look like an internal leak.
 */
export function safeErrorMessage(err: unknown, fallback = "Operation failed."): string {
  const e = err as ApiError | Error | undefined;
  const status = (e as ApiError | undefined)?.status;
  const raw = (e?.message ?? "").toString().trim();

  if (typeof status === "number") {
    if (status === 0) return "Settlement backend unreachable. Check your connection.";
    if (status >= 500) return "Settlement backend error — please try again.";
    if (status === 401 || status === 403) return "Authentication required.";
    if (status === 404) return "Resource not found.";
    if (status === 429) return "Rate limit reached — slow down and retry.";
    if (status >= 400 && status < 500) {
      return raw && !looksInternal(raw) ? raw : "Request rejected.";
    }
  }

  if (!raw) return fallback;
  return looksInternal(raw) ? fallback : raw;
}
