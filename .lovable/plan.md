# EnergyPay — Institutional Realism + Architecture + Polish Pass

This is a large, multi-area pass. To keep it surgical and reviewable, I'll execute in three focused phases over the existing codebase. No new backend logic, no fake APIs — only shape the frontend for real integration.

## Phase 1 — Institutional Realism

Goal: remove crypto/hackathon aesthetic, enforce clearing-house language and formatting everywhere visible.

Files touched (existing): `src/lib/institutional-data.ts`, `src/lib/mock-data.ts`, `src/lib/settlement-*.ts`, all `src/routes/{ops,clearing,reconciliation,oracle,risk,treasury,audit,topology,generator,wallet}.tsx`, `src/components/ops/*`, `src/components/generator/*`, `src/components/BlockchainActivityFeed.tsx`, `src/components/TokenAllocationPanel.tsx`.

Changes:
- Centralize terminology constants in new `src/lib/terminology.ts`:
  - Lifecycle states: `INTAKE → VALIDATED → MATCHED → ANCHORED → CLEARED → SETTLED | REJECTED | REVERSED`.
  - Severities: `NOMINAL | ELEVATED | DEGRADED | CRITICAL`.
  - Submercados: `SE/CO, S, NE, N` with canonical labels.
  - Counterparty registry (Eletrobras, Engie Brasil, EDP, CPFL, Cemig, Equatorial, Copel, Neoenergia, Auren, Light) with operator codes (e.g. `ELET3-OP`, `ENGI3-OP`).
- New formatters in `src/lib/formatters.ts`:
  - `fmtTxHash(hash)` → first 6 / last 4 with monospace ellipsis.
  - `fmtLedger(seq)` → `#<seq>` zero-padded to 9.
  - `fmtUtc(ts)` → `YYYY-MM-DD HH:mm:ss.SSS UTC`.
  - `fmtLatency(ms)` → realistic clearing latencies (180–2400 ms typical).
  - `fmtMWh`, `fmtBRL`, `fmtEPWR`, `fmtPct` with tabular-num.
- Replace ad-hoc statuses (`SUCCESS/PENDING/FAILED`) with new lifecycle pills via existing `SeverityBadge`, plus new `LifecycleBadge` in `src/components/ops/primitives.tsx`.
- Audit trail metadata: add `operatorId`, `sessionId`, `ipMasked`, `correlationId`, `parentEventId` to mock audit rows.
- Reconciliation rows: add `mismatchDelta`, `tolerance`, `retryCount`, `fallbackChannel`, `oracleSignerCount`.
- PLD references unified: `PLD_SE_CO_HOUR`, etc., with realistic R$/MWh ranges per submercado and time-of-day curve from `institutional-data.ts`.
- Exposure calculation helper `computeExposure({notional, mtm, margin, haircut})` and reuse on `/risk`, `/ops`, `/clearing`.
- Remove emoji / cartoon iconography from feeds; replace with `lucide-react` minimal icons + status dots.

## Phase 2 — Architecture Prep (no fake APIs)

Goal: separate UI from mock data, define normalized schemas, ready for real backend.

New files:
- `src/types/domain.ts` — canonical schemas (Zod) and TS types: `SettlementEvent`, `BilateralContract`, `Counterparty`, `OperatorIdentity`, `AuditEvent`, `ReconciliationRow`, `OracleSample`, `RiskExposure`, `TreasuryBalance`, `LedgerOperation`, plus `LifecycleState` and `Severity` enums.
- `src/services/` adapter layer (interface + mock impl):
  - `settlements.service.ts`, `clearing.service.ts`, `reconciliation.service.ts`, `oracle.service.ts`, `risk.service.ts`, `audit.service.ts`, `treasury.service.ts`, `topology.service.ts`.
  - Each exports `{ list, get, subscribe }` with a `MockAdapter` implementation; real adapter to be wired later. `subscribe` returns an unsubscribe fn — currently backed by `setInterval`, swappable for WebSocket.
- `src/services/transport.ts` — single seam: `httpAdapter` (fetch wrapper) and `wsAdapter` (no-op now, ready for real socket). All services consume `transport` only — no direct fetch in routes/components.
- `src/store/` (Zustand) integration points:
  - `useUiStore` (sidebar, density, theme) — already partial, normalize.
  - `useSelectionStore` (selected contract, selected counterparty, selected tx) for cross-panel drill-down.
  - `useLiveStore` (per-channel last update timestamps + connection health). Keep mock state out of these stores.
- `src/lib/query-keys.ts` — typed key factory (`qk.settlements.list(filter)`, etc.) for TanStack Query.
- `src/lib/optimistic.ts` — `applyOptimistic`, `rollback`, `withCorrelationId` helpers for future mutations.
- Reusable async patterns in `src/components/ops/AsyncStates.tsx`:
  - `<LoadingRows rows count />`, `<EmptyState title hint />`, `<DegradedBanner reason retryAt />`, `<RetryInline onRetry />`.
- Table primitive `src/components/ops/LiveTable.tsx` — accepts a `subscribe` adapter, renders sticky-header dense table with row-level "updated" pulse; used to replace inline tables in `/clearing`, `/reconciliation`, `/audit`, `/risk`.

Routes reorganization:
- Group operational routes under a `_ops` layout (`src/routes/_ops.tsx`) sharing `StatusRail` + sidebar context: ops, clearing, reconciliation, oracle, risk, treasury, audit, topology.
- Keep `/wallet`, `/generator`, `/register`, `/login` outside this layout.
- This is a non-breaking move — child files renamed to `_ops.ops.tsx` etc. so URLs stay identical.

Out of scope (explicit): No real HTTP calls, no schema changes to existing API routes, no auth changes, no swapping the existing `useWalletBalances` / `useWalletActivity` server fns — they already are the "real" adapter for wallet data.

## Phase 3 — Production Polish

Goal: Bloomberg-grade density and consistency.

- `src/styles.css`:
  - Tighten spacing scale: panel padding `12/16/20`, row height `28px` dense / `32px` default.
  - Typography hierarchy tokens: `.h-section` (13px semibold tracking-wide), `.h-panel` (11px label-op), `.kpi-num` 22px tabular, `.kpi-num-sm` 16px, `.num` 12px mono tabular.
  - Contrast pass: bump `--muted-foreground` to `oklch(0.66 0.02 250)` and table border to `oklch(0.22 0.018 252)` for readability on dark.
  - Subtle animation tokens: `--ease-ops: cubic-bezier(.2,.7,.2,1)`, durations 120/180/240ms. Remove any `glow`/`pulse` on non-status elements.
- Sidebar (`AppSidebar.tsx`):
  - Information architecture: `MARKET OPS` (Ops, Clearing, Topology) / `RISK & DATA` (Risk, Reconciliation, Oracle, Audit) / `SETTLEMENT` (Treasury, Wallet) / `TERMINALS` (Generator). Compact 11px section labels, 13px items, 4px row gap, active indicator = 2px left bar.
  - Persistent footer: operator id, session, version, build hash (mock now).
- Status / lifecycle badges standardized via single `LifecycleBadge` + `SeverityBadge` components — replace all ad-hoc colored spans.
- Data tables: sticky header, zebra-off, 1px hairline rows, right-aligned numerics, monospace hashes/ids, hover row highlight `oklch(0.18 0.02 252)`, focusable rows for keyboard nav.
- KPI hierarchy: primary KPIs `kpi-num` + sparkline + delta chip; secondary in `KpiStripCompact` (new variant) below.
- Transaction explorer presentation: tx rows show `LEDGER #` · `HASH` · `OP TYPE` · `COUNTERPARTY` · `NOTIONAL` · `LIFECYCLE` · `LATENCY` · open-in-Stellar-Expert icon; modal drill-down `<TxDetailSheet>` (right-side sheet, 480px) with operations list and audit chain.
- Modals: standardize via shadcn `Sheet` for drill-downs, `Dialog` only for confirmations. Z-index scale documented in `styles.css`.
- Animations: only `opacity` + `translateY(2px)` 180ms on row enter; status dot pulse only when `state === ACTIVE`. No flow-dashes on non-topology surfaces.

## Execution order

1. Phase 1 — terminology, formatters, lifecycle badge, audit/recon/PLD enrichment in `institutional-data.ts`.
2. Phase 2 — `types/domain.ts`, `services/*`, `store/*`, `query-keys`, `AsyncStates`, `LiveTable`, route layout grouping.
3. Phase 3 — `styles.css` tokens, sidebar IA, table primitive adoption, KPI variants, `TxDetailSheet`, modal/animation cleanup.

After each phase: spot-check `/ops`, `/clearing`, `/reconciliation`, `/risk`, `/audit`, `/treasury`, `/topology`, `/oracle`, `/generator`, `/wallet` build clean and render without regressions.

## Technical notes

- No new dependencies. Zod, Zustand, TanStack Query, recharts, shadcn already installed.
- Mock adapters live under `src/services/*/mock.ts` and re-export from a single `index.ts` per domain; real adapter implementations will drop in beside them later with no route/component changes.
- All time values normalized to ISO UTC strings in the domain layer; formatting only at the render boundary.
- Latency simulation uses log-normal distribution seeded by `institutional-data.ts` PRNG for reproducibility.
