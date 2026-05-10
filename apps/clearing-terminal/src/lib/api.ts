const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || `API Error ${response.status}`
    );
  }

  return data;
}

/* =========================
   AUTH
========================= */

export async function apiRegister(payload: unknown) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiLogin(payload: unknown) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* =========================
   P2P
========================= */

export type P2PValidationError = {
  code: string;
  field?: string;
  message: string;
};

export async function apiValidatedP2PTransfer(
  payload: unknown
) {
  return apiFetch("/api/p2p/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* =========================
   SETTLEMENT
========================= */

export type SettlementResult = {
  txHash?: string;
  ledger?: number;
  status?: string;
};

export async function apiExecuteSettlement(
  payload: unknown
): Promise<SettlementResult> {
  return apiFetch("/api/settlements/execute", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* =========================
   HEALTH
========================= */

export async function apiHealth() {
  return apiFetch("/api/health");
}