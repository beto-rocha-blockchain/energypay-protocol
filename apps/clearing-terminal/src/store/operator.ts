import { create } from "zustand";
import {
  apiLogin,
  apiRegister,
  type ApiUser,
  type RegisterPayload,
} from "@/lib/api";
import {
  getSession,
  setSession,
  clearSession,
  type AuthSession,
} from "@/lib/session";

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
  publicKey: string;
  network: "STELLAR_TESTNET" | string;
  funded: boolean;
  status: string;
};

export type OperatorCoords = { lat: number; lng: number; source: "GPS" | "MANUAL" };

export type OperatorIdentity = {
  operatorId: string;
  email: string;
  fullName: string;
  organization: string;
  country: string;
  city: string;
  coords?: OperatorCoords;
  settlementAddress: string;
  wallet: StellarKeypair;
  roles: ParticipantRole[];
  accessLevel: AccessLevel;
  permissions: string[];
  network: string;
  networkStatus: "ACTIVE" | "DEGRADED" | "OFFLINE";
  funded: boolean;
  provisionedAt: string;
  token: string;
  provisioningTxHash?: string | null;
  provisioningLedger?: number | null;
  settlementStatus?: string | null;
};

type OperatorState = {
  operator: OperatorIdentity | null;
  isAuthenticated: boolean;
  hydrate: () => void;
  login: (input: { email: string; password: string; organization?: string }) => Promise<OperatorIdentity>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    organization: string;
    country: string;
    city: string;
    roles: ParticipantRole[];
    coords?: OperatorCoords;
    fund?: boolean;
  }) => Promise<OperatorIdentity>;
  setRoles: (roles: ParticipantRole[]) => void;
  setCoords: (coords: OperatorCoords | undefined) => void;
  logout: () => void;
};

const ROLE_PERMISSIONS: Record<ParticipantRole, string[]> = {
  GENERATOR: ["generation.issue", "assets.read"],
  SELLER: ["settlements.execute", "contracts.write"],
  INVESTOR: ["portfolio.read", "analytics.read"],
  USER: ["billing.read", "consumption.read"],
};

const buildPermissions = (roles: ParticipantRole[]) => {
  const base = ["registry.read", "reconciliation.read"];
  const rolePerms = roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []);
  return Array.from(new Set([...base, ...rolePerms]));
};

const normalizeRoles = (roles: string[] | undefined): ParticipantRole[] => {
  const valid: ParticipantRole[] = ["GENERATOR", "SELLER", "INVESTOR", "USER"];
  if (!roles?.length) return ["SELLER"];
  return roles
    .map((r) => r.toUpperCase() as ParticipantRole)
    .filter((r): r is ParticipantRole => valid.includes(r));
};

const identityFromSession = (session: AuthSession): OperatorIdentity => {
  const u: ApiUser = session.user;
  const roles = normalizeRoles(u.roles);
  const wallet: StellarKeypair = {
    publicKey: u.stellar_public_key,
    network: u.network ?? "STELLAR_TESTNET",
    funded: !!u.funded,
    status: u.wallet_status ?? (u.funded ? "FUNDED" : "PROVISIONED"),
  };
  return {
    operatorId: u.id,
    email: u.email,
    fullName: u.full_name,
    organization: u.organization ?? "—",
    country: u.country ?? "—",
    city: u.city ?? "—",
    coords: u.coords
      ? { lat: u.coords.lat, lng: u.coords.lng, source: u.coords.source ?? "MANUAL" }
      : undefined,
    settlementAddress: u.stellar_public_key,
    wallet,
    roles,
    accessLevel: "OPERATOR",
    permissions: buildPermissions(roles),
    network: u.network ?? "STELLAR_TESTNET",
    networkStatus: "ACTIVE",
    funded: !!u.funded,
    provisionedAt: session.createdAt,
    token: session.token,
    provisioningTxHash: u.provisioning_tx_hash ?? null,
    provisioningLedger: u.provisioning_ledger ?? null,
    settlementStatus: u.settlement_status ?? (u.funded ? "FUNDED" : "PROVISIONED"),
  };
};

export const useOperator = create<OperatorState>()((set, get) => ({
  operator: null,
  isAuthenticated: false,

  hydrate: () => {
    const session = getSession();
    if (!session) {
      set({ operator: null, isAuthenticated: false });
      return;
    }
    set({ operator: identityFromSession(session), isAuthenticated: true });
  },

  login: async ({ email, password, organization }) => {
    if (!email || !password) {
      throw new Error("Operator email and password are required.");
    }
    const res = await apiLogin({ email, password, organization });
    const session: AuthSession = {
      token: res.token,
      user: res.user,
      createdAt: new Date().toISOString(),
    };
    setSession(session);
    const id = identityFromSession(session);
    set({ operator: id, isAuthenticated: true });
    return id;
  },

  register: async ({ email, password, fullName, organization, country, city, roles, coords, fund }) => {
    if (!roles.length) throw new Error("Select at least one market participant role.");
    const payload: RegisterPayload = {
      email,
      password,
      full_name: fullName,
      organization,
      country,
      city,
      roles,
      coords,
      fund: fund ?? true,
    };
    const res = await apiRegister(payload);
    const session: AuthSession = {
      token: res.token,
      user: res.user,
      createdAt: new Date().toISOString(),
    };
    setSession(session);
    const id = identityFromSession(session);
    set({ operator: id, isAuthenticated: true });
    return id;
  },

  setRoles: (roles) => {
    const op = get().operator;
    if (!op) return;
    set({ operator: { ...op, roles, permissions: buildPermissions(roles) } });
  },

  setCoords: (coords) => {
    const op = get().operator;
    if (!op) return;
    set({ operator: { ...op, coords } });
  },

  logout: () => {
    clearSession();
    set({ operator: null, isAuthenticated: false });
  },
}));

// Hydrate from sessionStorage on first load (browser only).
if (typeof window !== "undefined") {
  useOperator.getState().hydrate();
}

export const maskAddress = (addr: string) =>
  addr && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr || "—";

export const canExecuteSettlement = (op: OperatorIdentity | null) =>
  !!op &&
  (op.permissions.includes("settlements.execute") ||
    op.roles.includes("SELLER") ||
    op.accessLevel !== "OPERATOR" ||
    op.roles.includes("GENERATOR"));
