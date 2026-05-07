import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AccessLevel = "OPERATOR" | "SUPERVISOR" | "CLEARING_ADMIN";

export type OperatorIdentity = {
  operatorId: string;
  email: string;
  organization: string;
  settlementAddress: string;        // Stellar G... public key (mock)
  accessLevel: AccessLevel;
  permissions: string[];
  network: "STELLAR_TESTNET";
  networkStatus: "ACTIVE" | "DEGRADED" | "OFFLINE";
  funded: boolean;
  provisionedAt: string;
};

type OperatorState = {
  operator: OperatorIdentity | null;
  isAuthenticated: boolean;
  login: (input: { email: string; organization: string; accessKey: string }) => OperatorIdentity;
  provisionIdentity: (input: { email: string; organization: string; fund?: boolean }) => OperatorIdentity;
  logout: () => void;
};

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const rand = (n: number, alphabet: string) =>
  Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

/** Mock Stellar-style public key: starts with G, 56 chars total, base32. */
export const generateStellarAddress = () => `G${rand(55, B32)}`;

const orgToCode = (org: string) =>
  (org.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "OPER").padEnd(4, "X");

const makeOperatorId = (org: string) =>
  `OPR-${orgToCode(org)}-${Math.floor(1000 + Math.random() * 9000)}`;

const buildIdentity = (
  email: string,
  organization: string,
  opts: { fund?: boolean; accessLevel?: AccessLevel } = {},
): OperatorIdentity => ({
  operatorId: makeOperatorId(organization),
  email,
  organization,
  settlementAddress: generateStellarAddress(),
  accessLevel: opts.accessLevel ?? "OPERATOR",
  permissions: ["settlements.execute", "reconciliation.read", "registry.read"],
  network: "STELLAR_TESTNET",
  networkStatus: "ACTIVE",
  funded: opts.fund ?? true,
  provisionedAt: new Date().toISOString(),
});

export const useOperator = create<OperatorState>()(
  persist(
    (set) => ({
      operator: null,
      isAuthenticated: false,
      login: ({ email, organization, accessKey }) => {
        // Mock credential check — any non-empty access key authenticates.
        if (!email || !organization || !accessKey) {
          throw new Error("Operational credentials incomplete.");
        }
        const id = buildIdentity(email, organization, { fund: true });
        set({ operator: id, isAuthenticated: true });
        return id;
      },
      provisionIdentity: ({ email, organization, fund }) => {
        const id = buildIdentity(email, organization, { fund });
        set({ operator: id, isAuthenticated: true });
        return id;
      },
      logout: () => set({ operator: null, isAuthenticated: false }),
    }),
    {
      name: "energypay.operator.v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

/** Mask a Stellar address as `GABC…XY12` for institutional display. */
export const maskAddress = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
