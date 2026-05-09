import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OperatorIdentity, ParticipantRole } from "@/store/operator";
import { isValidPublicKey } from "@/lib/stellar";

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
  network: "STELLAR_TESTNET";
  preparedAt: string;
};

// Static valid Stellar Testnet ed25519 public keys for the demo counterparty
// registry. The frontend never generates or stores secret keys — these are
// placeholders surfaced until the backend exposes /api/counterparties.
const COUNTERPARTY_KEYS = [
  "GA5757OJNNAYHQTY2Y2T5QGMLRMDWZA4GGDXSYWZUT7SVJOW433TUUFV",
  "GBVSRXQLLLNHMXHTBUU23INIGCFLEEGLEIM4RKMH75526L5ONPYDPBY5",
  "GBZOUX5YKE2YW7UUUKJ2762AGDD6O3MTPUIG6NAGWCVHDZ763MXK4YFB",
  "GBT32LXQZNV2USNKVZU5EYH26BTH32QRIAZ7JV2F4NHRMLXP56CSRF2E",
  "GCTIYQERAOME4BMJXJKFTA6Q5YZGBHTLCW5YFBEBE23E7DDEW47TQKUQ",
];

const seedCounterparties: P2PCounterparty[] = [
  { organization: "Aurora Grid Energy",       role: "GENERATOR", jurisdiction: "BR-PR", settlementAddress: COUNTERPARTY_KEYS[0] },
  { organization: "Nexa Commercial Energy",   role: "SELLER",    jurisdiction: "BR-RJ", settlementAddress: COUNTERPARTY_KEYS[1] },
  { organization: "Atlas Energy Holdings",    role: "INVESTOR",  jurisdiction: "BR-SP", settlementAddress: COUNTERPARTY_KEYS[2] },
  { organization: "Metro Distribution Group", role: "USER",      jurisdiction: "BR-MG", settlementAddress: COUNTERPARTY_KEYS[3] },
  { organization: "Horizon Power Exchange",   role: "SELLER",    jurisdiction: "BR-DF", settlementAddress: COUNTERPARTY_KEYS[4] },
];

type P2PState = {
  transfers: P2PTransfer[];
  counterparties: P2PCounterparty[];
  recordTransfer: (t: P2PTransfer) => void;
  reset: () => void;
};

export const useP2P = create<P2PState>()(
  persist(
    (set) => ({
      transfers: [],
      counterparties: seedCounterparties,
      recordTransfer: (t) => set((s) => ({ transfers: [t, ...s.transfers].slice(0, 50) })),
      reset: () => set({ transfers: [], counterparties: seedCounterparties }),
    }),
    {
      name: "energypay.p2p.v2",
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
  network: "STELLAR_TESTNET",
  preparedAt: new Date().toISOString(),
});

export const isValidStellarPublicKey = (k: string) => isValidPublicKey(k);
