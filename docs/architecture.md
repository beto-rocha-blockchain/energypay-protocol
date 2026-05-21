# EnergyPay Architecture

EnergyPay is split into two runnable surfaces:

- Frontend and edge gateway: TanStack Start, React, TanStack Router, React Query and Zustand under `src/`.
- Settlement backend: Express, Supabase and Stellar SDK under `backend/`.

The frontend renders the institutional operating system. The backend owns account provisioning, JWT issuance, controlled Stellar Testnet signing and transaction submission.

## Runtime Layers

### 1. Operator UI

Routes in `src/routes/*.tsx` render the control room, settlement, P2P, treasury, wallet, risk, reconciliation, audit, oracle and generator terminals.

State is split across:

- `src/store/operator.ts` for authenticated operator identity.
- `src/store/operations.ts` for the current mock settlement operations state.
- `src/store/p2p.ts` for direct-settlement UI history and demo counterparties.

### 2. TanStack Start API Gateway

Server routes in `src/routes/api.*.ts` provide same-origin APIs for the UI:

- `/api/health` probes the settlement backend and Stellar Horizon.
- `/api/wallet/:publicKey/balances` reads balances from Horizon Testnet.
- `/api/wallet/:publicKey/activity` reads recent operations from Horizon Testnet.
- `/api/p2p/validate` validates a P2P settlement intent, applies authorization checks from JWT claims, and proxies to the backend.
- `/api/settlements/telemetry` exposes in-memory adapter telemetry.

The gateway does not hold Stellar secret keys. It validates, normalizes and proxies settlement requests.

### 3. Express Settlement Backend

`backend/src/app.js` exposes:

- `/api/auth/register` and `/api/auth/login`.
- `/api/wallet/*` for testnet wallet utilities.
- `/api/token/*` for EPWR trustline, minting and balances.
- `/api/p2p/transfer` for authenticated P2P settlement.
- `/api/settlement/execute` for legacy settlement execution.

The backend verifies JWTs with `JWT_SECRET`, signs Stellar Testnet transactions in a controlled MVP environment, submits them to Horizon Testnet and writes best-effort audit rows to Supabase.

### 4. Stellar Testnet

Stellar is used for:

- XLM custody payments from `STELLAR_SECRET`.
- EPWR issued-asset payments from `DISTRIBUTION_SECRET`.
- EPWR issuer derivation from `ISSUER_SECRET` or an explicit issuer public key.
- Public account reads through Horizon Testnet.

## P2P Settlement Flow

1. The operator logs in through the backend and receives a JWT.
2. The UI posts a settlement intent to `/api/p2p/validate`.
3. The TanStack gateway validates the payload and derives the sender from JWT claims.
4. The gateway forwards the request and `Authorization` header to `backend /api/p2p/transfer`.
5. The backend verifies the JWT signature and role.
6. The backend submits a Stellar payment using the requested destination, amount, asset and memo.
7. The backend returns a canonical receipt with tx hash, ledger, source, destination, asset, amount and finality latency.

## Configuration

Local backend configuration belongs in `backend/.env`. The file must not be committed. Use `backend/.env.example` as the safe template.

Required backend variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `MASTER_ENCRYPTION_KEY`
- `STELLAR_SECRET`
- `ISSUER_SECRET`
- `DISTRIBUTION_SECRET`

Optional variables:

- `PORT`
- `STELLAR_DESTINATION`
- `EPWR_ISSUER_PUBLIC_KEY`

Frontend build-time variables:

- `VITE_API_URL` points the browser client at the Express backend. Default: `http://localhost:3000`.
- `P2P_BACKEND_URL` points TanStack server routes at the Express backend. Default: `http://localhost:3000`.

## Persistence

Today there are two persistence modes:

- Supabase for backend user and settlement audit records.
- In-memory TanStack gateway storage for retry-safe settlement receipts and telemetry.

The in-memory gateway store is intentionally replaceable. For production, replace `src/lib/settlement-store.ts` with a durable database-backed implementation.

## Security Boundaries

- Browser code never handles Stellar secret seeds.
- `backend/.env` stays local and ignored.
- P2P backend routes verify JWT signatures before signing transactions.
- The backend overwrites `sender_user_id` from the verified token instead of trusting the client body.
- Testnet custody accounts must be treated as disposable until key management is moved to a proper vault or HSM.
  
This architecture is intended for Stellar Testnet MVP validation and is not a production custody or regulated settlement architecture.
