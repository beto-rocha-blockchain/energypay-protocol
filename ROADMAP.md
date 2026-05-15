# EnergyPay Roadmap

## Phase 0 - Repository Hygiene

- Remove committed environment secrets and keep only `.env.example` templates.
- Keep build and lint green.
- Document current architecture, runtime boundaries and operational flows.

## Phase 1 - Testnet Settlement Reliability

- Finalize P2P settlement against Stellar Testnet for XLM and EPWR.
- Add idempotency persistence outside process memory.
- Normalize settlement receipts across backend and TanStack gateway.
- Add integration tests for invalid destination, invalid amount, unauthorized operator and Horizon rejection.

## Phase 2 - Backend Hardening

- Move secret custody from local environment variables to managed secret storage.
- Encrypt user Stellar seeds at rest or remove user seed custody entirely.
- Add request-level audit logging for all settlement mutations.
- Add rate limits and structured error responses.

## Phase 3 - Product Data Model

- Replace demo contract and counterparty state with Supabase-backed tables.
- Add durable settlement, reconciliation, risk and audit tables.
- Introduce migrations and seed scripts.
- Define canonical API schemas with Zod or OpenAPI.

## Phase 4 - Institutional Operations

- Add role-based permission management beyond broad market roles.
- Add manual review queues for high-value or failed settlements.
- Add retry and reversal workflows.
- Add exportable audit and reconciliation reports.

## Phase 5 - Mainnet Readiness

- Run external security review.
- Add key rotation and incident procedures.
- Move from Stellar Testnet to controlled mainnet pilot.
- Define compliance, custody and operational support responsibilities.
