import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ParticipantRole } from "@/store/operator";

export type EnergyType = "SOLAR" | "HYDRO" | "WIND" | "THERMAL" | "GRID";
export type NodeStatus = "ACTIVE" | "DEGRADED" | "OFFLINE";

export type GridNode = {
  id: string;
  organization: string;
  role: ParticipantRole;
  energyType: EnergyType;
  capacityMW: number;
  status: NodeStatus;
  settlementAddress: string;
  region: string;
  jurisdiction: string;
  coords: { lat: number; lng: number };
  lastSettlementAgo: string;
  recentSettlements: { id: string; amount: number; ago: string }[];
  connections: string[]; // ids of peer nodes
  uptime: number; // 0..100
};

// Static valid Stellar Testnet G-addresses (ed25519 public keys, no secrets).
// These represent registered demo participants in the operational grid registry
// and are replaced by backend-issued addresses when the registry API is wired.
const PARTICIPANT_PUBLIC_KEYS = [
  "GA5757OJNNAYHQTY2Y2T5QGMLRMDWZA4GGDXSYWZUT7SVJOW433TUUFV",
  "GBVSRXQLLLNHMXHTBUU23INIGCFLEEGLEIM4RKMH75526L5ONPYDPBY5",
  "GBZOUX5YKE2YW7UUUKJ2762AGDD6O3MTPUIG6NAGWCVHDZ763MXK4YFB",
  "GBT32LXQZNV2USNKVZU5EYH26BTH32QRIAZ7JV2F4NHRMLXP56CSRF2E",
  "GCTIYQERAOME4BMJXJKFTA6Q5YZGBHTLCW5YFBEBE23E7DDEW47TQKUQ",
  "GDZHP4ESUSU7MOP5OBGF3GERRRHGCDQMELS3SLZUDXYL3NPSJHWO346Y",
  "GDSP23IZR2U6JCFPJ6YNABYLHGPW3DA5KNDXH6RQVSVCBXQDROSJUH65",
  "GDWTLAC7O7AQGGTPPWOICUR7NU73CYKVYHAZH4EAQ3C27UI634RHCAKL",
  "GA3WMEC32JPJFYELRBM4TU52JCFR72IWCA3V3KLVKTIFYS5ISUTR3GEK",
  "GBKKC5NQTCTHI4FVYZU7YU4C4PBUQU25H33IYZNNZPP7PP2OCB6JNWF5",
  "GDTMGUNQOCSAKXA7TR37DC45I3BAZBEYH4KFUZ6XD4QDJGQVPSGACS3L",
  "GACA7J2LQZ2KQ6XC6YRADTQCK3QDQPIXMRUHMOUXDK5XVYYJKYK6LGKO",
];
let _addrIdx = 0;
const G = () => PARTICIPANT_PUBLIC_KEYS[_addrIdx++ % PARTICIPANT_PUBLIC_KEYS.length];

const seedNodes: GridNode[] = [
  {
    id: "NODE-AUR-01", organization: "Aurora Grid Energy", role: "GENERATOR",
    energyType: "SOLAR", capacityMW: 480, status: "ACTIVE",
    settlementAddress: G(), region: "Northeast Corridor", jurisdiction: "BR-PE",
    coords: { lat: -8.05, lng: -34.9 }, lastSettlementAgo: "32s",
    recentSettlements: [
      { id: "STL-90211", amount: 862400, ago: "32s" },
      { id: "STL-90204", amount: 412000, ago: "14m" },
    ],
    connections: ["NODE-MER-02", "NODE-HOR-04"], uptime: 99.97,
  },
  {
    id: "NODE-NOV-02", organization: "NovaHydro Power", role: "GENERATOR",
    energyType: "HYDRO", capacityMW: 1820, status: "ACTIVE",
    settlementAddress: G(), region: "South Reservoir Basin", jurisdiction: "BR-PR",
    coords: { lat: -25.43, lng: -54.58 }, lastSettlementAgo: "1m",
    recentSettlements: [{ id: "STL-90208", amount: 1240800, ago: "1m" }],
    connections: ["NODE-MER-02", "NODE-MET-07"], uptime: 99.92,
  },
  {
    id: "NODE-SOL-03", organization: "Solaris Renewables", role: "GENERATOR",
    energyType: "SOLAR", capacityMW: 320, status: "DEGRADED",
    settlementAddress: G(), region: "Central Plateau", jurisdiction: "BR-GO",
    coords: { lat: -16.68, lng: -49.25 }, lastSettlementAgo: "4m",
    recentSettlements: [{ id: "STL-90203", amount: 188900, ago: "4m" }],
    connections: ["NODE-VOL-05"], uptime: 97.8,
  },
  {
    id: "NODE-ATL-04", organization: "Atlas Generation", role: "GENERATOR",
    energyType: "WIND", capacityMW: 640, status: "ACTIVE",
    settlementAddress: G(), region: "Coastal Wind Belt", jurisdiction: "BR-RN",
    coords: { lat: -5.79, lng: -35.2 }, lastSettlementAgo: "2m",
    recentSettlements: [{ id: "STL-90209", amount: 412900, ago: "2m" }],
    connections: ["NODE-AUR-01", "NODE-HOR-04"], uptime: 99.6,
  },
  {
    id: "NODE-NEX-05", organization: "Nexa Commercial Energy", role: "SELLER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Southeast Trading Zone", jurisdiction: "BR-RJ",
    coords: { lat: -22.91, lng: -43.2 }, lastSettlementAgo: "11m",
    recentSettlements: [{ id: "STL-90209", amount: 218750, ago: "11m" }],
    connections: ["NODE-MER-02", "NODE-HOR-04"], uptime: 99.99,
  },
  {
    id: "NODE-MER-02", organization: "Meridian Trading Desk", role: "SELLER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Southeast Trading Zone", jurisdiction: "BR-SP",
    coords: { lat: -23.55, lng: -46.63 }, lastSettlementAgo: "44s",
    recentSettlements: [
      { id: "STL-90213", amount: 544800, ago: "44s" },
      { id: "STL-90208", amount: 218750, ago: "8m" },
    ],
    connections: ["NODE-AUR-01", "NODE-NOV-02", "NODE-NEX-05"], uptime: 99.99,
  },
  {
    id: "NODE-VOL-05", organization: "Voltix Energy Markets", role: "SELLER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Central Trading Hub", jurisdiction: "BR-DF",
    coords: { lat: -15.79, lng: -47.88 }, lastSettlementAgo: "3m",
    recentSettlements: [{ id: "STL-90205", amount: 318400, ago: "3m" }],
    connections: ["NODE-SOL-03", "NODE-HOR-04"], uptime: 99.85,
  },
  {
    id: "NODE-HOR-04", organization: "Horizon Power Exchange", role: "SELLER",
    energyType: "GRID", capacityMW: 0, status: "DEGRADED",
    settlementAddress: G(), region: "Southeast Clearing", jurisdiction: "BR-MG",
    coords: { lat: -19.92, lng: -43.94 }, lastSettlementAgo: "18m",
    recentSettlements: [{ id: "STL-90207", amount: 154600, ago: "18m" }],
    connections: ["NODE-AUR-01", "NODE-ATL-04", "NODE-NEX-05", "NODE-VOL-05"], uptime: 98.4,
  },
  {
    id: "NODE-MET-07", organization: "Metro Distribution Group", role: "USER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Southeast Distribution", jurisdiction: "BR-MG",
    coords: { lat: -18.55, lng: -44.5 }, lastSettlementAgo: "6m",
    recentSettlements: [{ id: "STL-90212", amount: -19208, ago: "6m" }],
    connections: ["NODE-NOV-02", "NODE-MER-02"], uptime: 99.5,
  },
  {
    id: "NODE-DEL-08", organization: "Delta Industrial Load", role: "USER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Industrial Corridor", jurisdiction: "BR-SC",
    coords: { lat: -27.6, lng: -48.55 }, lastSettlementAgo: "9m",
    recentSettlements: [{ id: "STL-90206", amount: -42100, ago: "9m" }],
    connections: ["NODE-NOV-02"], uptime: 99.3,
  },
  {
    id: "NODE-URB-09", organization: "UrbanGrid Cooperative", role: "USER",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Urban Distribution", jurisdiction: "BR-RS",
    coords: { lat: -30.03, lng: -51.23 }, lastSettlementAgo: "14m",
    recentSettlements: [{ id: "STL-90201", amount: -88420, ago: "14m" }],
    connections: ["NODE-NOV-02", "NODE-DEL-08"], uptime: 99.6,
  },
  {
    id: "NODE-NOR-10", organization: "Northline Utilities", role: "USER",
    energyType: "THERMAL", capacityMW: 280, status: "OFFLINE",
    settlementAddress: G(), region: "Northern Thermal Block", jurisdiction: "BR-PA",
    coords: { lat: -1.46, lng: -48.49 }, lastSettlementAgo: "1h",
    recentSettlements: [{ id: "STL-90188", amount: 96420, ago: "1h" }],
    connections: ["NODE-AUR-01"], uptime: 88.2,
  },
  {
    id: "NODE-HLD-11", organization: "Atlas Energy Holdings", role: "INVESTOR",
    energyType: "GRID", capacityMW: 0, status: "ACTIVE",
    settlementAddress: G(), region: "Treasury Clearing", jurisdiction: "BR-SP",
    coords: { lat: -23.96, lng: -46.33 }, lastSettlementAgo: "21m",
    recentSettlements: [{ id: "STL-90199", amount: 318900, ago: "21m" }],
    connections: ["NODE-MER-02", "NODE-HOR-04"], uptime: 99.95,
  },
];

type GridState = {
  nodes: GridNode[];
  reset: () => void;
};

export const useGrid = create<GridState>()(
  persist(
    (set) => ({
      nodes: seedNodes,
      reset: () => set({ nodes: seedNodes }),
    }),
    {
      name: "energypay.grid.v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

/** Project lat/lng (Brazil-centric mock map) into 0..1 viewport space. */
export const projectCoords = (lat: number, lng: number) => {
  // bounding box roughly Brazil + margin
  const minLat = -34, maxLat = 6;
  const minLng = -75, maxLng = -33;
  const x = (lng - minLng) / (maxLng - minLng);
  const y = 1 - (lat - minLat) / (maxLat - minLat);
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
};

export const ENERGY_LABEL: Record<EnergyType, string> = {
  SOLAR: "Solar PV",
  HYDRO: "Hydroelectric",
  WIND: "Wind",
  THERMAL: "Thermal",
  GRID: "Grid · Settlement",
};

export const STATUS_TONE: Record<NodeStatus, "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  DEGRADED: "warning",
  OFFLINE: "destructive",
};
