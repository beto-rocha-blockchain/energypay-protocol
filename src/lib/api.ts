/**
 * Backend API client — talks to the EnergyPay settlement backend.
 *
 * Default base URL: http://localhost:3000
 * Override with VITE_API_URL at build time.
 *
 * The backend is the only authority for:
 *   - wallet creation
 *   - Friendbot funding
 *   - password validation
 *   - Stellar signing
 *   - transaction submission
 *   - settlement execution
 *
 * The frontend never generates wallets or hashes — it only renders backend data.
 */

import { getSession } from "@/lib/session";

export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export type ApiError = Error & {
  status?: number;
  payload?: unknown;
};

const buildError = (status: number, message: string, payload?: unknown): ApiError => {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.payload = payload;
  return err;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const session = getSession();
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    throw buildError(0, `Network error reaching backend (${API_BASE_URL}). ${(err as Error).message}`);
  }

  const ctype = res.headers.get("content-type") || "";
  const data = ctype.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in (data as Record<string, unknown>) && String((data as Record<string, unknown>).error)) ||
      (data && typeof data === "object" && "message" in (data as Record<string, unknown>) && String((data as Record<string, unknown>).message)) ||
      `Request failed with ${res.status}`;
    throw buildError(res.status, message, data);
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */

export type ApiUser = {
  id: string;
  email: string;
  full_name: string;
  organization?: string;
  country?: string;
  city?: string;
  roles: string[];
  stellar_public_key: string;
  wallet_status?: string;
  funded?: boolean;
  network?: string;
  coords?: { lat: number; lng: number; source?: "GPS" | "MANUAL" } | null;
  provisioning_tx_hash?: string | null;
  provisioning_ledger?: number | null;
  settlement_status?: string | null;
};

export type AuthResponse = {
  token: string;
  user: ApiUser;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  organization: string;
  country: string;
  city: string;
  roles: string[];
  coords?: { lat: number; lng: number; source: "GPS" | "MANUAL" };
  fund?: boolean;
};

export type LoginPayload = {
  email: string;
  password: string;
  organization?: string;
};

export const apiRegister = (payload: RegisterPayload) =>
  apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });

export const apiLogin = (payload: LoginPayload) =>
  apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: payload,
    auth: false,
  });

/* ------------------------------------------------------------------ */
/*  Settlement engine                                                 */
/* ------------------------------------------------------------------ */

export type SettlementExecutePayload = {
  contract_id: string;
  settlement_id?: string;
  counterparty: string;
  amount_brl: number;
  pld: number;
  window: string;
  memo?: string;
};

export type SettlementResult = {
  settlement_id: string;
  contract_id: string;
  tx_hash: string;
  ledger: number;
  finality_ms: number;
  status: "SETTLED" | "FAILED" | "PENDING";
  signer_public_key?: string;
  source_public_key?: string;
  error?: string;
};

export const apiExecuteSettlement = (payload: SettlementExecutePayload) =>
  apiRequest<SettlementResult>("/api/settlements/execute", {
    method: "POST",
    body: payload,
  });

/* ------------------------------------------------------------------ */
/*  Direct settlement / P2P transfer                                  */
/* ------------------------------------------------------------------ */

export type P2PTransferPayload = {
  sender_user_id: string;
  recipient_public_key: string;
  asset: "EPWR" | "XLM";
  amount: number;
  memo?: string;
};

export type P2PLifecycleStatus =
  | "IDLE"
  | "PREPARING"
  | "SIGNING"
  | "BROADCASTING"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "FINALIZED"
  | "FAILED";

/**
 * Canonical settlement receipt — the only shape the frontend renders.
 * Sourced 1:1 from the backend adapter, which derives every field from a
 * real Horizon submission.
 */
export type SettlementReceipt = {
  transfer_id: string;
  tx_hash: string;
  ledger: number;
  sender: string;
  recipient: string;
  asset: "EPWR" | "XLM";
  amount: number;
  memo: string;
  submitted_at: string;
  finalized_at: string;
  latency_ms: number;
  explorer_url: string;
  status: P2PLifecycleStatus;
  idempotent_replay?: boolean;
  error?: string;
};

/** Backwards-compatible alias used by older call sites. */
export type P2PTransferResult = SettlementReceipt & {
  // mirrored fields kept for transition compatibility
  source_public_key?: string;
  destination_public_key?: string;
  finality_ms?: number;
  explorer_link?: string;
  timestamp?: string;
};

export const apiSubmitP2PTransfer = (payload: P2PTransferPayload) =>
  apiRequest<P2PTransferResult>("/api/p2p/transfer", {
    method: "POST",
    body: payload,
  });

/**
 * Server-side validated submission. Hits the local TanStack gateway
 * `/api/p2p/validate` (same origin), which validates the payload against the
 * canonical Zod schema and proxies to the settlement backend on success.
 * Returns 422 with `{ code, field, message }` for invalid payloads — the UI
 * uses this to surface field-level errors.
 */
export type P2PValidationError = {
  code: string;
  field: string;
  message: string;
};

export async function apiValidatedP2PTransfer(
  payload: P2PTransferPayload & { transfer_id?: string },
): Promise<P2PTransferResult> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch("/api/p2p/validate", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = buildError(
      res.status,
      (data as P2PValidationError)?.message || `Settlement rejected (${res.status})`,
      data,
    );
    throw err;
  }
  return data as P2PTransferResult;
}


/* ------------------------------------------------------------------ */
/*  Registry (best-effort) — counterparties & grid nodes              */
/* ------------------------------------------------------------------ */

export type CounterpartyDTO = {
  organization: string;
  role: "GENERATOR" | "SELLER" | "INVESTOR" | "USER";
  jurisdiction: string;
  settlement_address: string;
};

export const apiListCounterparties = () =>
  apiRequest<CounterpartyDTO[]>("/api/counterparties", { method: "GET" });
