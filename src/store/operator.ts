import { create } from "zustand";
import { apiLogin, apiRegister, type ApiUser, type RegisterPayload } from "@/lib/api";
import { getSession, setSession, clearSession, type AuthSession } from "@/lib/session";
import { STELLAR_NETWORK } from "@/lib/stellar";

export type AccessLevel = "OPERATOR" | "SUPERVISOR" | "CLEARING_ADMIN";

export type ParticipantRole = "GENERATOR" | "SELLER" | "INVESTOR" | "USER" | "UTILITY";

/**
 * Role color system — single source of truth for the entire platform.
 *   GENERATOR → red     (#f87171 / red-400)
 *   SELLER    → blue    (#38bdf8 / sky-400)
 *   INVESTOR  → yellow  (#facc15 / yellow-400)
 *   USER      → green   (#4ade80 / green-400)
 *   UTILITY   → orange  (#fb923c / orange-400)
 */
export type RoleColor = {
  /** Tailwind border class fragment */
  border: string;
  /** Tailwind bg class fragment */
  bg: string;
  /** Tailwind text class fragment */
  text: string;
  /** Raw hex for SVG / inline styles */
  hex: string;
};

export const ROLE_COLORS: Record<ParticipantRole, RoleColor> = {
  GENERATOR: { border: "border-red-400/50",    bg: "bg-red-400/10",    text: "text-red-400",    hex: "#f87171" },
  SELLER:    { border: "border-sky-400/50",    bg: "bg-sky-400/10",    text: "text-sky-400",    hex: "#38bdf8" },
  INVESTOR:  { border: "border-yellow-400/50", bg: "bg-yellow-400/10", text: "text-yellow-400", hex: "#facc15" },
  USER:      { border: "border-green-400/50",  bg: "bg-green-400/10",  text: "text-green-400",  hex: "#4ade80" },
  UTILITY:   { border: "border-orange-400/50", bg: "bg-orange-400/10", text: "text-orange-400", hex: "#fb923c" },
};

export const ROLE_META: Record<
  ParticipantRole,
  { label: string; tagline: string; capabilities: string[]; color: RoleColor }
> = {
  GENERATOR: {
    label: "Generator",
    tagline: "Produces energy · sell-side only",
    capabilities: ["Issue energy certificates", "Create sell contracts", "Receive EPWR settlements"],
    color: ROLE_COLORS.GENERATOR,
  },
  SELLER: {
    label: "Seller",
    tagline: "Buys from generators · resells at market rate",
    capabilities: ["Buy from generators", "Resell to consumers", "Manage buy/sell spread"],
    color: ROLE_COLORS.SELLER,
  },
  INVESTOR: {
    label: "Investor",
    tagline: "Passive EPWR exposure · appreciates over time",
    capabilities: ["Track EPWR portfolio", "Monitor PLD price", "Yield & analytics"],
    color: ROLE_COLORS.INVESTOR,
  },
  USER: {
    label: "Consumer",
    tagline: "Purchases energy · pays per kWh consumed",
    capabilities: ["Buy energy contracts", "Track kWh consumption", "Direct payment"],
    color: ROLE_COLORS.USER,
  },
  UTILITY: {
    label: "Utility",
    tagline: "Concessionária · distribution & grid operations",
    capabilities: ["Manage UC registry", "Collect TUSD settlements", "Grid connection certificates"],
    color: ROLE_COLORS.UTILITY,
  },
};

export type StellarKeypair = {
  publicKey: string;
  network: string;
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
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string | null;
  provisioningTxHash?: string | null;
  provisioningLedger?: number | null;
  settlementStatus?: string | null;
};

type OperatorState = {
  operator: OperatorIdentity | null;
  isAuthenticated: boolean;
  hydrate: () => void;
  login: (input: {
    email: string;
    password: string;
    organization?: string;
  }) => Promise<OperatorIdentity>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    organization: string;
    country: string;
    city: string;
    roles: ParticipantRole[];
    coords?: OperatorCoords;
    fund?: boolean;
    energyType?: "SOLAR" | "HYDRO" | "SMALL_HYDRO" | "WIND" | "BIOMASS" | "NATURAL_GAS" | "NUCLEAR" | "THERMAL" | "COGENERATION";
    walletMode?: "generate" | "link";
    existingPublicKey?: string;
    existingSecretKey?: string;
  }) => Promise<OperatorIdentity>;
  setRoles: (roles: ParticipantRole[]) => void;
  setCoords: (coords: OperatorCoords | undefined) => void;
  setEmailVerified: (v: boolean) => void;
  setPhoneVerified: (v: boolean) => void;
  setPhone: (phone: string) => void;
  logout: () => void;
};

const ROLE_PERMISSIONS: Record<ParticipantRole, string[]> = {
  GENERATOR: ["generation.issue", "assets.read"],
  SELLER: ["settlements.execute", "contracts.write"],
  INVESTOR: ["portfolio.read", "analytics.read"],
  USER: ["billing.read", "consumption.read"],
  UTILITY: ["grid.manage", "tusd.collect", "uc.registry"],
};

const buildPermissions = (roles: ParticipantRole[]) => {
  const base = ["registry.read", "reconciliation.read"];
  const rolePerms = roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []);
  return Array.from(new Set([...base, ...rolePerms]));
};

/** Canonical display order for participant roles — single source of truth. */
const ROLE_ORDER: ParticipantRole[] = [
  "GENERATOR",
  "SELLER",
  "INVESTOR",
  "UTILITY",
  "USER",
];

const normalizeRoles = (roles: string[] | undefined): ParticipantRole[] => {
  if (!roles?.length) return ["SELLER"];
  return roles
    .map((r) => r.toUpperCase() as ParticipantRole)
    .filter((r): r is ParticipantRole => ROLE_ORDER.includes(r))
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
};

const identityFromSession = (session: AuthSession): OperatorIdentity => {
  const u: ApiUser = session.user;
  const roles = normalizeRoles(u.roles);
  const wallet: StellarKeypair = {
    publicKey: u.stellar_public_key,
    network: u.network ?? STELLAR_NETWORK,
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
    network: u.network ?? STELLAR_NETWORK,
    networkStatus: "ACTIVE",
    funded: !!u.funded,
    emailVerified: !!u.email_verified,
    phoneVerified: !!u.phone_verified,
    phone: u.phone ?? null,
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

  register: async ({
    email,
    password,
    fullName,
    phone,
    organization,
    country,
    city,
    roles,
    coords,
    fund,
    energyType,
    walletMode,
    existingPublicKey,
    existingSecretKey,
  }) => {
    if (!roles.length) throw new Error("Select at least one market participant role.");
    const payload: RegisterPayload = {
      email,
      password,
      full_name: fullName,
      phone: phone || undefined,
      organization,
      country,
      city,
      roles,
      coords,
      fund: fund ?? true,
      energy_type: energyType,
      wallet_mode: walletMode,
      existing_public_key: walletMode === "link" ? existingPublicKey : undefined,
      existing_secret: walletMode === "link" ? existingSecretKey : undefined,
    };
    const res = await apiRegister(payload);
    const session: AuthSession = {
      token: res.token,
      user: res.user,
      createdAt: new Date().toISOString(),
    };
    setSession(session);

    localStorage.setItem("token", res.token);

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

  setEmailVerified: (v) => {
    const op = get().operator;
    if (!op) return;
    set({ operator: { ...op, emailVerified: v } });
  },

  setPhoneVerified: (v) => {
    const op = get().operator;
    if (!op) return;
    set({ operator: { ...op, phoneVerified: v } });
  },

  setPhone: (phone) => {
    const op = get().operator;
    if (!op) return;
    set({ operator: { ...op, phone, phoneVerified: false } });
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
