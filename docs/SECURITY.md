# EnergyPay Security Notes

## Overview

This document describes the current security model, assumptions and limitations of the EnergyPay MVP.

EnergyPay is currently a Stellar Testnet MVP designed for technical validation, grant evaluation and market discovery. It is not a production financial system, does not handle real funds and does not perform regulated settlement activity.

The current security model is intentionally scoped to MVP validation.

---

## Current Security Scope

The current MVP focuses on:

- Stellar Testnet execution only;
- controlled server-side signing for MVP validation;
- authenticated settlement routes;
- role-based authorization;
- environment-based secret management;
- no browser-side Stellar secret seed handling;
- transaction evidence generation;
- audit-oriented settlement persistence.

The current implementation should not be used for production settlement, custody, mainnet operations or regulated financial activity.

---

## Security Boundaries

EnergyPay currently follows these boundaries:

- no production funds;
- no Stellar mainnet settlement;
- no regulated financial settlement;
- no production custody;
- no banking integration;
- no PIX integration;
- no live energy market settlement;
- no client-side private key exposure in the demonstrated settlement flow.

The MVP is designed to prove technical feasibility and settlement evidence generation on Stellar Testnet.

---

## Authentication

The backend uses JWT-based authentication for protected flows.

Authentication is used to:

- identify the operator;
- authorize protected actions;
- restrict settlement execution;
- derive sender/operator context from verified claims;
- avoid trusting client-provided identity fields.

JWT verification should happen on the backend before any settlement action is executed.

---

## Authorization

Settlement execution should be restricted by operator role.

In the current MVP, settlement execution is limited to authorized roles such as:

- `SELLER`;
- `GENERATOR`.

Unauthorized roles should not be able to execute settlement transactions.

The backend should never trust role values sent directly from the client body. Any client-controlled role or access-level fields should be ignored or removed before processing.

---

## Server-Side Signing

The current MVP uses controlled server-side signing for Stellar Testnet transaction execution.

This is acceptable for MVP validation because:

- the system runs on Stellar Testnet;
- no production funds are involved;
- testnet custody accounts are disposable;
- the goal is to demonstrate settlement execution and evidence generation.

However, this architecture is not suitable for production custody without significant changes.

Before production or mainnet use, EnergyPay would require:

- production-grade key management;
- vault or HSM integration;
- transaction policy controls;
- access segregation;
- audit logs for signing operations;
- incident response procedures;
- formal security review.

---

## Secret Management

Secrets must be stored only in environment variables or secure secret managers.

Sensitive values may include:

- `STELLAR_SECRET`;
- `ISSUER_SECRET`;
- `DISTRIBUTION_SECRET`;
- `JWT_SECRET`;
- `MASTER_ENCRYPTION_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Rules:

- never commit real secrets;
- keep `backend/.env` ignored;
- use `.env.example` only with safe placeholder values;
- rotate secrets immediately if exposed;
- use testnet-only secrets during MVP validation;
- avoid placing secrets in frontend code;
- avoid exposing service-role database keys to the browser.

---

## Browser Security Boundary

The browser/frontend must not handle Stellar secret seeds.

The frontend can display:

- public keys;
- settlement status;
- txHash;
- ledger;
- memo;
- Stellar Expert links;
- audit receipts.

The frontend must not expose:

- Stellar secret seeds;
- JWT signing secrets;
- Supabase service role keys;
- private custody credentials;
- production signing credentials.

---

## Input Validation

The backend should validate settlement inputs before building or submitting transactions.

Validation should include:

- destination public key format;
- positive amount;
- supported asset;
- memo normalization;
- authenticated operator identity;
- authorized operator role;
- required environment configuration.

Invalid requests should return controlled errors and should not trigger transaction submission.

---

## Stellar Public Key Validation

Destination accounts must be validated as Stellar public keys before transaction construction.

A valid destination should be an Ed25519 Stellar public key beginning with `G`.

Invalid destination values should be rejected before reaching Horizon.

---

## Amount Validation

Settlement amounts must be validated before transaction submission.

Validation should reject:

- empty amounts;
- non-numeric values;
- zero values;
- negative values;
- malformed decimal values.

Production systems would also require stronger limits, policies and risk controls.

---

## Asset Validation

The current MVP supports testnet settlement using:

- XLM;
- EPWR.

Unsupported assets should be rejected.

Issued assets such as EPWR require additional trustline and issuer/distribution account considerations on Stellar Testnet.

---

## Memo Handling

Memos help connect EnergyPay settlement records to Stellar transactions.

Memo handling should:

- remove unsafe characters when needed;
- respect Stellar memo length limits;
- avoid storing sensitive personal or financial data;
- use settlement references rather than confidential contract content.

Memos are publicly visible on-chain and should be treated as public metadata.

---

## Supabase Security Notes

Supabase is used for MVP persistence and audit-oriented settlement records.

Security rules:

- never expose Supabase service role keys to frontend code;
- use server-side writes for privileged operations;
- restrict table access with appropriate policies before production;
- avoid storing private keys in database tables;
- avoid storing unnecessary sensitive personal data;
- separate public demo data from private operational data.

Future production versions should define:

- row-level security policies;
- organization-based access controls;
- audit log retention;
- data lifecycle policies;
- backup and recovery processes.

---

## x402-Compatible Flow Security

The current x402-compatible module uses Stellar Testnet transaction hashes as payment proofs.

The backend verifies:

- transaction existence;
- transaction success;
- expected memo;
- expected destination;
- required amount;
- expected asset.

Current MVP limitations may include:

- simplified payment proof model;
- no production billing;
- no replay-protection hardening;
- no customer-specific payment sessions;
- no commercial invoicing or tax handling.

Before production use, this module would require:

- replay protection;
- payment session IDs;
- stronger billing logic;
- customer identity mapping;
- usage metering;
- monitoring and fraud controls.

---

## Audit Evidence

EnergyPay uses transaction evidence to support auditability.

Evidence may include:

- settlement ID;
- contract ID;
- txHash;
- ledger;
- memo;
- source public key;
- destination public key;
- amount;
- asset;
- status;
- timestamp;
- Stellar Expert link.

This evidence helps reviewers and stakeholders verify that a settlement shown in the application corresponds to a real Stellar Testnet transaction.

---

## Known MVP Limitations

The current MVP has limitations that are acceptable for testnet validation but not for production.

Known limitations include:

- testnet-only settlement;
- controlled server-side signing;
- limited authorization model;
- simulated market data;
- simulated or demo contract data;
- limited operational monitoring;
- limited error recovery;
- no formal security audit;
- no production key management;
- no regulatory compliance framework;
- no mainnet readiness process.

---

## Not Production Ready

EnergyPay is not currently production-ready for:

- real-money settlement;
- Stellar mainnet transactions;
- regulated financial operations;
- production custody;
- banking flows;
- PIX flows;
- live energy market settlement;
- enterprise-grade compliance operations.

The current implementation is an MVP for technical demonstration and validation.

---

## Required Before Production

Before any production deployment, EnergyPay would require:

- formal security audit;
- threat modeling;
- production key management;
- vault or HSM integration;
- strict access control;
- organization-level permissions;
- production observability;
- monitoring and alerting;
- incident response plan;
- data protection review;
- legal and regulatory review;
- KYC/KYB design;
- compliance framework;
- mainnet readiness plan;
- financial partner review.

---

## Threat Areas to Review

Future reviews should consider:

- private key exposure;
- environment variable leakage;
- unauthorized settlement execution;
- JWT misconfiguration;
- replay attacks in API payment flows;
- malicious destination addresses;
- insufficient input validation;
- Supabase access misconfiguration;
- frontend exposure of backend-only secrets;
- excessive privilege on service-role keys;
- dependency vulnerabilities;
- operational logging of sensitive data.

---

## Development Security Checklist

Before each public demo or submission:

- confirm `.env` files are not committed;
- confirm only `.env.example` contains placeholders;
- rotate any exposed credentials;
- verify frontend does not include secret values;
- test unauthorized settlement attempts;
- test invalid destination public keys;
- test invalid amount values;
- confirm Stellar Expert links point to Testnet;
- confirm documentation clearly states MVP/Testnet scope;
- confirm no production financial claims are made.

---

## Repository Hygiene

Recommended repository practices:

- keep `.env` ignored;
- keep `.env.example` updated;
- avoid committing generated secrets;
- avoid committing private keys;
- avoid committing database service role keys;
- run dependency checks periodically;
- review pull requests before merging;
- keep documentation aligned with implemented code;
- remove obsolete variables when no longer used.

---

## Final Security Statement

EnergyPay currently demonstrates a controlled Stellar Testnet settlement architecture.

The MVP is intentionally limited to technical validation and does not perform production settlement, regulated financial activity or mainnet custody.

Future production versions must replace MVP signing and operational assumptions with production-grade security, compliance, custody and infrastructure controls.
