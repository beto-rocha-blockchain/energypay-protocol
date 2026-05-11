## EnergyPay Institutional Operating System — Build Plan

A unified, institution-grade operations suite layered onto the existing TanStack Start app. Eight connected modules sharing one design system, one navigation shell, and a coherent data layer that reuses what already exists (`useWalletBalances`, `useWalletActivity`, `useSettlementRail`, `useGeneratorTelemetry`, settlement telemetry endpoints) and extends it with realistic institutional datasets.

### Design System (foundation, done first)

- Refresh `src/styles.css` tokens for an ultra-institutional dark palette:
  - background: deep blue-black (`oklch(0.14 0.02 250)`)
  - surface / surface-elevated: graphite layers
  - primary: muted cyan (operational accent)
  - success: settlement green; warning: amber; destructive: critical red
  - mono grid lines, thin 1px borders, no glassmorphism, no gradients-as-decoration
- Typography: keep `font-display` (institutional sans) + `font-mono` (terminal). Add `.label-op` (uppercase, tracking-widest, 10px) utility, `.kpi-num` (tabular nums, tight).
- Shared widgets in `src/components/ops/`:
  - `OpsShell` (sidebar + topbar + status rail)
  - `KpiTile`, `KpiStrip`, `Sparkline`
  - `TelemetryBar`, `StatusDot`, `SeverityBadge`
  - `DataTable` (dense, sortable, sticky header, zebra-off, monospace numerics)
  - `TimelineRail`, `StateMachineView`
  - `AlertStream`, `AuditEntry`

### Navigation Shell

- Rework `src/components/AppSidebar.tsx` into an institutional left rail grouped by domain:
  - Operations: Market Ops, Clearing House, Network Topology
  - Risk & Data: Reconciliation, Oracles & Market Data, Risk & Collateral
  - Settlement: Treasury & Rails, Audit & Compliance
  - Existing: Wallet, Generator Terminal, P2P, Settlement, Grid, Contracts
- Persistent top status bar showing rail state, Horizon latency, session operator, UTC clock — fed by `useSettlementRail`.

### Modules (one route each)

1. `/ops` Market Operations Center — `src/routes/ops.tsx`
   - KPI strip: cleared notional (24h), settlement throughput (tx/min), open exposure, intraday PLD, reconciliation health %, p95 finality.
   - Live throughput chart (recharts area) + counterparty activity heatstrip.
   - Operational alerts feed (severity-coded) + liquidity stress gauge.

2. `/clearing` Clearing House Console — `src/routes/clearing.tsx`
   - Bilateral contract lifecycle table (reuse `BilateralContractsPanel` enriched with margin & exposure columns).
   - Settlement queue with state machine view (NEW → VALIDATED → SIGNED → BROADCAST → FINALIZED / FAILED) using existing `settlement-state-machine`.
   - Margin monitoring panel, audit checkpoint timeline, ledger anchoring (Stellar tx hashes via `stellarExpertTx`).

3. `/topology` Energy Network Topology — `src/routes/topology.tsx`
   - SVG SCADA map (extend `BrazilGridMap`) with node types: Generator, Distributor, Trader, Consumer, Investor.
   - Animated corridor flows, regional node status (ONLINE/DEGRADED/OFFLINE), side panel with selected-node telemetry.

4. `/reconciliation` Reconciliation Engine — `src/routes/reconciliation.tsx`
   - Pipeline stages (Ingest → Match → Verify → Anchor → Confirm) with throughput per stage.
   - Mismatch queue table, oracle verification panel, retry/fallback controls, audit trail explorer.

5. `/oracle` Oracle & Market Data Center — `src/routes/oracle.tsx`
   - PLD feed monitor (4 submercados SE/S/NE/N), latency per feed, divergence alerts.
   - Historical PLD line chart, fallback oracle indicator, regional pricing tiles.

6. `/risk` Risk & Collateral Management — `src/routes/risk.tsx`
   - Counterparty risk table with exposure / collateral ratio / settlement confidence.
   - Exposure heatmap (counterparty × tenor), default simulation card, liquidity reserves bar.

7. `/treasury` Treasury & Settlement Rails — `src/routes/treasury.tsx`
   - Integrates `WalletBalancesPanel`, `TokenAllocationPanel`, `StellarRailMonitor`, `LiveSettlementFeed`.
   - Adds payment routing diagram (Generator → Clearing → BRL settlement leg), broadcast/finality stats, custody operations log.

8. `/audit` Audit & Compliance Center — `src/routes/audit.tsx`
   - Immutable audit log table (driven by `opsTail()` via existing `/api/settlements/telemetry`).
   - Operator action feed, KYC status board, regulatory report generator (mock export buttons), provenance drill-down for any tx hash.

### Data Layer

- New helper `src/lib/institutional-data.ts` — deterministic seeded generators for counterparties, PLD curves, reconciliation exceptions, risk exposures. Single source of truth across modules so numbers tie together.
- Reuse server functions: `/api/wallet/:pk/balances`, `/api/wallet/:pk/activity`, `/api/settlements/telemetry`, `/api/health`.
- No new backend logic — institutional datasets are derived/simulated client-side from the operator's wallet + telemetry counters so everything still updates live from the real settlement rail.

### Visual Rules Enforced

- Only semantic tokens; no hard-coded colors in components.
- All tables: monospace numerics, right-aligned, 11–12px, sticky header, 1px borders.
- All labels: `.label-op` (uppercase tracking-widest 10px muted).
- No glass, no neon glow on decorative-only surfaces (glow reserved for active operational indicators).
- Dense grids, generous information hierarchy, narrow line-height.

### Out of Scope (deliberately)

- Backend schema changes / new server functions (existing endpoints suffice).
- Auth role model changes.
- Mobile-first layout — institutional desktop first (≥1280px), graceful at 1024px.

### Acceptance

- 8 new routes mounted, sidebar grouped, top status rail live.
- Every page renders with live data hooks where available, deterministic seeded data otherwise.
- Build passes (`routeTree.gen.ts` regenerated by plugin).
- Visual QA on `/ops`, `/clearing`, `/topology`, `/treasury` matches institutional aesthetic.
