# Stellar Notes

## Why Stellar Fits EnergyPay

EnergyPay needs a payment rail with low fees, short finality, issued assets and public auditability. Stellar maps well to this prototype because it supports native XLM, issued assets such as EPWR, memo fields for reconciliation references, account-level trustlines and Horizon APIs for ledger reads.

## Current Usage In This Repo

- Horizon Testnet account reads power wallet balances and activity.
- `STELLAR_SECRET` signs XLM settlement payments.
- `ISSUER_SECRET` identifies the EPWR issuer.
- `DISTRIBUTION_SECRET` signs EPWR distribution payments.
- Stellar Expert links are used for operator-facing transaction audit.

## Design Constraints

- Issued assets require the destination account to create a trustline before it can receive EPWR.
- Stellar memo text is limited to 28 bytes, so settlement references must be short.
- Sequence numbers are account scoped, so concurrent signing from the same custody account needs queueing or retry handling.
- Testnet Friendbot is useful for onboarding demos but is not a production funding model.

## Production Questions

- Should EnergyPay custody assets centrally, or should each market participant self-custody?
- Should EPWR represent energy inventory, a settlement voucher, or only a demo accounting unit?
- What is the durable source of truth for contract state: database first, ledger first, or dual-write with reconciliation?
- What signing architecture is acceptable for regulated institutional users?

## Near-Term Engineering Tasks

- Add deterministic idempotency keys for every settlement request.
- Persist settlement receipts in Supabase or Postgres.
- Add sequence-number retry logic for concurrent custody submissions.
- Test EPWR failure modes: missing trustline, insufficient balance, bad issuer, unauthorized destination.
