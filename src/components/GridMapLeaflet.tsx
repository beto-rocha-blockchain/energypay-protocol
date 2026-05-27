// Client-only component — imported exclusively via React.lazy() in grid.tsx
// Never rendered during SSR. All Leaflet code is safe here.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Polyline,
  useMap,
} from "react-leaflet";
import type { GridNode } from "@/store/grid";

// ── Color maps ────────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  GENERATOR: "#22c55e",
  SELLER:    "#60a5fa",
  INVESTOR:  "#f59e0b",
  USER:      "#94a3b8",
  UTILITY:   "#fb923c",
};

/** Status overrides role color when set. */
const STATUS_COLOR: Record<string, string | null> = {
  ACTIVE:   null,
  DEGRADED: "#f59e0b",
  OFFLINE:  "#ef4444",
};

const STATUS_OPACITY: Record<string, number> = {
  ACTIVE:   0.9,
  DEGRADED: 0.55,
  OFFLINE:  0.3,
};

// ── AutoBounds ────────────────────────────────────────────────────────────────
/** Fits the map to all markers once, on first render with data. */
function AutoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) {
      map.setView(points[0], 9, { animate: false });
    } else {
      try {
        map.fitBounds(points, { padding: [55, 55], maxZoom: 11, animate: false });
      } catch {
        map.setView([-14.235, -51.925], 4, { animate: false });
      }
    }
  }, [map, points]);

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
type Props = {
  nodes: GridNode[];
  operatorCoords: { lat: number; lng: number } | null;
  operatorName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function GridMapLeaflet({
  nodes,
  operatorCoords,
  operatorName,
  selectedId,
  onSelect,
}: Props) {
  const opPos: [number, number] | null = operatorCoords
    ? [operatorCoords.lat, operatorCoords.lng]
    : null;

  // All points used for auto-fitting viewport
  const allPoints: [number, number][] = [
    ...nodes.map((n) => [n.coords.lat, n.coords.lng] as [number, number]),
    ...(opPos ? [opPos] : []),
  ];

  // Build connection lines only for the currently selected node
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;
  const connectionLines: Array<[[number, number], [number, number]]> = selectedNode
    ? selectedNode.connections
        .map((cid) => nodes.find((n) => n.id === cid))
        .filter((p): p is GridNode => !!p)
        .map((peer) => [
          [selectedNode.coords.lat, selectedNode.coords.lng],
          [peer.coords.lat, peer.coords.lng],
        ])
    : [];

  return (
    <MapContainer
      center={opPos ?? [-14.235, -51.925]}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      {/* CartoDB Dark Matter tiles — free, no API key needed */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      <AutoBounds points={allPoints} />

      {/* Dashed connection lines to peers of selected node */}
      {connectionLines.map(([a, b], i) => (
        <Polyline
          key={i}
          positions={[a, b]}
          color="#22c55e"
          weight={1.5}
          opacity={0.5}
          dashArray="5 5"
        />
      ))}

      {/* Participant markers */}
      {nodes.map((n) => {
        const fillColor = STATUS_COLOR[n.status] ?? ROLE_COLOR[n.role] ?? "#94a3b8";
        const fillOpacity = STATUS_OPACITY[n.status] ?? 0.9;
        const isSelected = n.id === selectedId;

        return (
          <CircleMarker
            key={n.id}
            center={[n.coords.lat, n.coords.lng]}
            radius={isSelected ? 11 : 7}
            fillColor={fillColor}
            fillOpacity={fillOpacity}
            color={isSelected ? "#ffffff" : "rgba(0,0,0,0.25)"}
            weight={isSelected ? 2.5 : 1}
            eventHandlers={{ click: () => onSelect(n.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div>
                <strong
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#e2e8f0",
                    display: "block",
                  }}
                >
                  {n.organization.slice(0, 26)}
                </strong>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "10px",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {n.role} · {n.region}
                  {n.approximateLocation ? " · ~approx" : ""}
                </span>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Operator "YOU" marker — cyan, permanent label */}
      {opPos && (
        <CircleMarker
          center={opPos}
          radius={10}
          fillColor="#06b6d4"
          fillOpacity={0.92}
          color="#ffffff"
          weight={2.5}
        >
          <Tooltip direction="top" offset={[0, -12]} permanent opacity={1}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#06b6d4",
                fontWeight: "bold",
              }}
            >
              YOU · {(operatorName || "").slice(0, 16)}
            </span>
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
