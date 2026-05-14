/**
 * EnergyPay service layer — adapter façade.
 *
 * Each domain exposes `{ list, get, subscribe }`. Today these are backed
 * by deterministic mock data from `src/lib/institutional-data.ts`. When
 * real backends come online, swap the `*.mock` import for `*.live` —
 * components do not change.
 *
 * The `subscribe` method returns an unsubscribe function. Mock impls use
 * `setInterval` to emit refreshed snapshots; the WebSocket impl will be
 * a thin wrapper around `transport.ws`.
 */
export * from "./settlements.service";
export * from "./clearing.service";
export * from "./reconciliation.service";
export * from "./oracle.service";
export * from "./risk.service";
export * from "./audit.service";
export * from "./treasury.service";
export * from "./topology.service";
