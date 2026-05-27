import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OperatorIdentity, ParticipantRole } from "@/store/operator";
import { isValidPublicKey, STELLAR_NETWORK } from "@/lib/stellar";
import { API_BASE_URL } from "@/lib/api";
import { getSession } from "@/lib/session";

export type P2PAsset = "EPWR" | "XLM";

/**
 * Settlement lifecycle states for the direct rail. The backend is the
 * authority for transitions; the frontend renders the operator-facing
 * sequence and never advances state on its own past PREPARING/SIGNING.
 */
export type P2PTransferState =
  | "DRAFT"
  | "PREPARING"
  | "SIGNING"
  | "BROADCASTING"
  | "CONFIRMING"
  | "FINALIZED"
  | "FAILED";

export type P2PTransfer = {
  id: string;
  ts: string;
  sourcePublicKey: string;
  destinationPublicKey: string;
  destinationOrg: string;
  asset: P2PAsset;
  amount: number;
  memo: string;
  txHash: string;
  ledger: number;
  latencyMs: number;
  state: P2PTransferState;
  operatorId: string;
  explorerLink?: string;
};

export type P2PCounterparty = {
  organization: string;
  role: "GENERATOR" | "SELLER" | "INVESTOR" | "USER";
  jurisdiction: string;
  settlementAddress: string;
};

export type P2PAuthorization = {
  sourcePublicKey: string;
  destinationPublicKey: string;
  asset: P2PAsset;
  amount: number;
  memo: string;
  operatorId: string;
  roles: ParticipantRole[];
  network: string;
  preparedAt: string;
};

type P2PState = {
  transfers: P2PTransfer[];
  counterparties: P2PCounterparty[];
  loadingCp: boolean;
  fetchCounterparties: () => Promise<void>;
  recordTransfer: (t: P2PTransfer) => void;
  reset: () => void;
};

export const useP2P = create<P2PState>()(
  persist(
    (set, get) => ({
      transfers: [],
      counterparties: [],
      loadingCp: false,

      fetchCounterparties: async () => {
        if (get().loadingCp) return;
        set({ loadingCp: true });
        try {
          const session = getSession();
          const headers: Record<string, string> = { Accept: "application/json" };
          if (session?.token) headers.Authorization = `Bearer ${session.token}`;

          const res = await fetch(`${API_BASE_URL}/api/auth/counterparties`, { headers });
          const data = await res.json();
          if (data.success && data.counterparties) {
            const mapped: P2PCounterparty[] = data.counterparties.map((c: {
              organization?: string;
              full_name?: string;
              roles?: string[];
              country?: string;
              city?: string;
              stellar_public_key: string;
            }) => ({
              organization: c.organization || c.full_name || "—",
              role: (c.roles?.[0] as P2PCounterparty["role"]) || "USER",
              jurisdiction: `${c.city || "—"} · ${c.country || "—"}`,
              settlementAddress: c.stellar_public_key,
            }));
            set({ counterparties: mapped });
          }
        } catch {
          // silent — manual key entry still works
        } finally {
          set({ loadingCp: false });
        }
      },

      recordTransfer: (t) => set((s) => ({ transfers: [t, ...s.transfers].slice(0, 50) })),
      reset: () => set({ transfers: [], counterparties: [] }),
    }),
    {
      name: "energypay.p2p.v3",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

export const buildP2PAuthorization = (
  operator: OperatorIdentity,
  input: { destinationPublicKey: string; asset: P2PAsset; amount: number; memo: string },
): P2PAuthorization => ({
  sourcePublicKey: operator.wallet.publicKey,
  destinationPublicKey: input.destinationPublicKey,
  asset: input.asset,
  amount: input.amount,
  memo: input.memo,
  operatorId: operator.operatorId,
  roles: operator.roles,
  network: STELLAR_NETWORK,
  preparedAt: new Date().toISOString(),
});

export const isValidStellarPublicKey = (k: string) => isValidPublicKey(k);
