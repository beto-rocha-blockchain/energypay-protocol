import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AccessLevel = "OPERATOR" | "SUPERVISOR" | "CLEARING_ADMIN";

export type ParticipantRole = "GENERATOR" | "SELLER" | "INVESTOR" | "USER";

export const ROLE_META: Record<
  ParticipantRole,
  { label: string; tagline: string; capabilities: string[] }
> = {
  GENERATOR: {
    label: "Generator",
    tagline: "Energy issuance · tokenized production",
    capabilities: ["Generation assets", "Energy issuance", "Tokenized production"],
  },
  SELLER: {
    label: "Seller",
    tagline: "Commercialization · contract settlement",
    capabilities: ["Energy commercialization", "Contract settlement", "Market operations"],
  },
  INVESTOR: {
    label: "Investor",
    tagline: "Portfolio exposure · financial reconciliation",
    capabilities: ["Portfolio exposure", "Settlement analytics", "Financial reconciliation"],
  },
  USER: {
    label: "User",
    tagline: "Consumption · billing visibility",
    capabilities: ["Energy consumption", "Billing visibility", "Settlement history"],
  },
};

export type StellarKeypair = {
  publicKey: string; // G...
  secretKey: string; // S...
  network: "STELLAR_TESTNET";
  funded: boolean;
  createdAt: string;
};

export type OperatorIdentity = {
  operatorId: string;
  email: string;
  fullName: string;
  organization: string;
  country: string;
  city: string;
  settlementAddress: string;
  wallet: StellarKeypair;
  roles: ParticipantRole[];
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
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    organization: string;
    country: string;
    city: string;
    roles: ParticipantRole[];
    fund?: boolean;
  }) => OperatorIdentity;
  setRoles: (roles: ParticipantRole[]) => void;
  logout: () => void;
};

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const rand = (n: number, alphabet: string) =>
  Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

export const generateStellarAddress = () => `G${rand(55, B32)}`;
export const generateStellarSecret = () => `S${rand(55, B32)}`;
export const generateStellarKeypair = (funded = true): StellarKeypair => ({
  publicKey: generateStellarAddress(),
  secretKey: generateStellarSecret(),
  network: "STELLAR_TESTNET",
  funded,
  createdAt: new Date().toISOString(),
});

const orgToCode = (org: string) =>
  (org.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "OPER").padEnd(4, "X");

const makeOperatorId = (org: string) =>
  `OPR-${orgToCode(org)}-${Math.floor(1000 + Math.random() * 9000)}`;

const ROLE_PERMISSIONS: Record<ParticipantRole, string[]> = {
  GENERATOR: ["generation.issue", "assets.read"],
  SELLER: ["settlements.execute", "contracts.write"],
  INVESTOR: ["portfolio.read", "analytics.read"],
  USER: ["billing.read", "consumption.read"],
};

const buildPermissions = (roles: ParticipantRole[]) => {
  const base = ["registry.read", "reconciliation.read"];
  const rolePerms = roles.flatMap((r) => ROLE_PERMISSIONS[r]);
  return Array.from(new Set([...base, ...rolePerms]));
};

export const useOperator = create<OperatorState>()(
  persist(
    (set, get) => ({
      operator: null,
      isAuthenticated: false,
      login: ({ email, organization, accessKey }) => {
        if (!email || !organization || !accessKey) {
          throw new Error("Operational credentials incomplete.");
        }
        const wallet = generateStellarKeypair(true);
        const roles: ParticipantRole[] = ["SELLER"];
        const id: OperatorIdentity = {
          operatorId: makeOperatorId(organization),
          email,
          fullName: email.split("@")[0],
          organization,
          country: "—",
          city: "—",
          settlementAddress: wallet.publicKey,
          wallet,
          roles,
          accessLevel: "OPERATOR",
          permissions: buildPermissions(roles),
          network: "STELLAR_TESTNET",
          networkStatus: "ACTIVE",
          funded: true,
          provisionedAt: new Date().toISOString(),
        };
        set({ operator: id, isAuthenticated: true });
        return id;
      },
      register: ({ email, fullName, organization, country, city, roles, fund }) => {
        if (!roles.length) throw new Error("Select at least one market participant role.");
        const wallet = generateStellarKeypair(fund ?? true);
        const id: OperatorIdentity = {
          operatorId: makeOperatorId(organization),
          email,
          fullName,
          organization,
          country,
          city,
          settlementAddress: wallet.publicKey,
          wallet,
          roles,
          accessLevel: "OPERATOR",
          permissions: buildPermissions(roles),
          network: "STELLAR_TESTNET",
          networkStatus: "ACTIVE",
          funded: fund ?? true,
          provisionedAt: new Date().toISOString(),
        };
        set({ operator: id, isAuthenticated: true });
        return id;
      },
      setRoles: (roles) => {
        const op = get().operator;
        if (!op) return;
        set({ operator: { ...op, roles, permissions: buildPermissions(roles) } });
      },
      logout: () => set({ operator: null, isAuthenticated: false }),
    }),
    {
      name: "energypay.operator.v2",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

export const maskAddress = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
