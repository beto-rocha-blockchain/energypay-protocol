import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OperatorIdentity, ParticipantRole } from "@/store/operator";

export type P2PAsset = "EPWR" | "XLM";

export type P2PTransferState =
  | "DRAFT"
  | "AUTHORIZING"
  | "SIGNING"
  | "BROADCASTING"
  | "CONFIRMED"
  | "SETTLED"
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
};

export type P2PCounterparty = {
  organization: string;
  role: "GENERATOR" | "SELLER" | "INVESTOR" | "USER";
  jurisdiction: string;
  settlementAddress: string;
};

export type P2PAuthorization = {
  sourcePublicKey: string;
  sourceSecret?: string;
  destinationPublicKey: string;
  asset: P2PAsset;
  amount: number;
  memo: string;
  operatorId: string;
  roles: ParticipantRole[];
  network: "STELLAR_TESTNET";
  preparedAt: string;
};

import { generateKeypair, isValidPublicKey } from "@/lib/stellar";

const stellarG = () => generateKeypair().publicKey;

const seedCounterparties: P2PCounterparty[] = [
  { organization: "Aurora Grid Energy", role: "GENERATOR", jurisdiction: "BR-PR", settlementAddress: stellarG() },
  { organization: "Nexa Commercial Energy", role: "SELLER", jurisdiction: "BR-RJ", settlementAddress: stellarG() },
  { organization: "Atlas Energy Holdings", role: "INVESTOR", jurisdiction: "BR-SP", settlementAddress: stellarG() },
  { organization: "Metro Distribution Group", role: "USER", jurisdiction: "BR-MG", settlementAddress: stellarG() },
  { organization: "Horizon Power Exchange", role: "SELLER", jurisdiction: "BR-DF", settlementAddress: stellarG() },
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
      name: "energypay.p2p.v1",
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
