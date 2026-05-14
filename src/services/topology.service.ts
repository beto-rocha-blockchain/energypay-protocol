import { TOPO_NODES, TOPO_EDGES } from "@/lib/institutional-data";
import { pollSubscription, type ReadService, nowIso } from "./_base";
import type { ListResult } from "@/types/domain";

export type TopologyNode = (typeof TOPO_NODES)[number];
export type TopologyEdge = (typeof TOPO_EDGES)[number];
export type TopologySnapshot = TopologyNode;

export const topologyService: ReadService<TopologySnapshot, void> & {
  edges: () => Promise<TopologyEdge[]>;
} = {
  async list() {
    return { items: TOPO_NODES, total: TOPO_NODES.length, asOf: nowIso(), source: "MOCK" } as ListResult<TopologyNode>;
  },
  async get(id) {
    return TOPO_NODES.find((n) => n.id === id) ?? null;
  },
  async edges() {
    return TOPO_EDGES;
  },
  subscribe(onUpdate, _f, intervalMs = 30_000) {
    return pollSubscription(this.list.bind(this), onUpdate, undefined, intervalMs);
  },
};
