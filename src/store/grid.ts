import { create } from "zustand";
import type { ParticipantRole } from "@/store/operator";
import { apiGridParticipants, type GridParticipantDTO } from "@/lib/api";

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
  /** true when GPS was not provided — coords are city-level approximations */
  approximateLocation: boolean;
};

/** Convert a backend GridParticipantDTO into a GridNode for the UI. */
const dtoToNode = (p: GridParticipantDTO): GridNode => ({
  id: p.id,
  organization: p.organization,
  role: (p.role as ParticipantRole) || "USER",
  energyType: (p.energyType as EnergyType) || "GRID",
  capacityMW: 0,
  status: "ACTIVE",
  settlementAddress: p.settlementAddress,
  region: p.region,
  jurisdiction: p.jurisdiction,
  coords: { lat: p.coords.lat, lng: p.coords.lng },
  lastSettlementAgo: "—",
  recentSettlements: [],
  connections: [],
  uptime: 100,
  approximateLocation: p.approximate_location ?? false,
});

type GridState = {
  nodes: GridNode[];
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  fetch: () => Promise<void>;
  reset: () => void;
};

export const useGrid = create<GridState>()((set, get) => ({
  nodes: [],
  loading: false,
  error: null,
  fetchedAt: null,

  fetch: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const res = await apiGridParticipants();
      const nodes = (res.participants || []).map(dtoToNode);

      // Build connections: link nodes within 800 km of each other
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dLat = nodes[i].coords.lat - nodes[j].coords.lat;
          const dLng = nodes[i].coords.lng - nodes[j].coords.lng;
          const approxKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
          if (approxKm < 800) {
            nodes[i].connections.push(nodes[j].id);
            nodes[j].connections.push(nodes[i].id);
          }
        }
      }

      set({ nodes, loading: false, fetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  reset: () => set({ nodes: [], fetchedAt: null, error: null }),
}));

/** Project lat/lng (Brazil-centric) into 0..1 viewport space. */
export const projectCoords = (lat: number, lng: number) => {
  const minLat = -34,
    maxLat = 6;
  const minLng = -75,
    maxLng = -33;
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

/** Haversine distance between two lat/lng points, in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
