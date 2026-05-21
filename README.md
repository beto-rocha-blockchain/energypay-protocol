# EnergyPay ⚡

## Programmable Settlement Infrastructure for Energy Markets

EnergyPay is a programmable settlement and reconciliation infrastructure for energy contracts, using Stellar as a verifiable financial rail for contract execution, audit evidence, and future energy API monetization.

The project demonstrates how bilateral energy settlement obligations can move from fragmented manual workflows into a digital, auditable and programmable settlement process.

EnergyPay is being built as part of the Stellar 37 ecosystem journey, with an initial MVP focused on Stellar Testnet settlement execution, digital contract registration, transaction evidence, and operational auditability.

---

## The Problem

Energy markets are becoming more decentralized, competitive and data-driven, but many settlement workflows still rely on fragmented operational processes.

Bilateral energy contracts often involve:

- manual reconciliation;
- delayed payment confirmation;
- disconnected financial workflows;
- spreadsheet-based operational controls;
- limited settlement visibility;
- counterparty risk;
- lack of real-time audit evidence;
- difficulty connecting contract obligations to financial execution.

As the free energy market expands, especially in markets such as Brazil, participants need more transparent and programmable infrastructure to register, execute and verify settlement events.

---

## The Solution

EnergyPay introduces a programmable settlement layer for energy contracts.

The platform allows energy market participants to register digital settlement obligations, execute simulated settlements on Stellar Testnet, and verify the full transaction lifecycle through audit dashboards, transaction hashes, ledger numbers, memos and Stellar Expert links.

EnergyPay is not just a tokenization prototype.

It is designed as an operational and financial infrastructure layer for:

- bilateral energy contract settlement;
- programmable payment execution;
- reconciliation automation;
- audit evidence generation;
- settlement lifecycle monitoring;
- future machine-to-machine energy payments;
- premium energy market API monetization.

---

## Current MVP

The current MVP demonstrates a complete testnet-based workflow:

1. A bilateral energy settlement obligation is represented inside the platform.
2. The user executes a programmable settlement flow.
3. The backend submits a real transaction to Stellar Testnet.
4. The system returns verifiable transaction evidence.
5. The settlement event is displayed with txHash, ledger, memo, status and Stellar Expert link.
6. The audit trail can be used to support reconciliation and operational verification.

---

## Live Demo

**Application:**  
[EnergyPay Live Demo](https://energypay-protocol.vercel.app/)

**GitHub Repository:**  
[energypay-protocol](https://github.com/beto-rocha-blockchain/energypay-protocol)

---

## Key Features

### Digital Energy Contract Registry

EnergyPay provides a digital contract registry layer to model bilateral energy settlement obligations.

The registry is designed to represent core contract data such as:

- buyer;
- seller;
- energy volume;
- reference price;
- settlement date;
- contract status;
- contract reference;
- settlement lifecycle state.

This creates the digital foundation required before settlement execution.

---

### Stellar Testnet Settlement Rail

EnergyPay connects energy contract obligations to Stellar Testnet settlement execution.

The settlement rail captures and displays:

- source wallet;
- destination wallet;
- asset;
- amount;
- transaction hash;
- ledger number;
- memo;
- finality time;
- settlement status;
- Stellar Expert explorer link.

This makes each settlement event externally verifiable.

---

### Direct Settlement

The Direct Settlement module allows users to execute a payment flow through Stellar Testnet and receive real transaction evidence.

The current implementation supports settlement execution with:

- Stellar SDK;
- Horizon Testnet;
- backend-side transaction signing;
- transaction submission;
- txHash return;
- ledger confirmation;
- Stellar Expert link generation;
- audit record persistence.

---

### Audit & Reconciliation Layer

EnergyPay includes an audit-oriented dashboard and settlement evidence flow.

The goal is to reduce reconciliation friction by providing a clear operational view of settlement lifecycle states, such as:

- registered;
- pending;
- executed;
- finalized;
- confirmed;
- failed;
- canceled.

This layer is intended to help market participants verify what happened, when it happened and where the transaction can be independently inspected.

---

### x402-Compatible Energy API Access

EnergyPay also demonstrates an x402-compatible payment flow for premium energy market APIs.

The current implementation uses Stellar Testnet transactions as verifiable payment proofs for API access.

The x402-compatible flow demonstrates:

1. A protected API resource returns HTTP 402 Payment Required.
2. The backend provides payment requirement metadata.
3. A Stellar Testnet payment is executed.
4. The transaction hash is submitted as payment proof.
5. The backend verifies memo, destination, amount and transaction success through Horizon.
6. Premium energy market data access is unlocked.

This module shows how future energy APIs, oracle feeds and market data services could be monetized through programmable payment rails.

---

## Architecture Overview

EnergyPay combines a modern web application with Stellar-based settlement execution.

```txt
Energy Contract Obligation
        ↓
Digital Contract Registry
        ↓
Settlement Instruction
        ↓
Backend Settlement Engine
        ↓
Stellar Testnet / Horizon
        ↓
txHash + Ledger + Memo
        ↓
Audit Dashboard + Reconciliation Evidence
```

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- TanStack Router / TanStack Start
- Zustand
- Tailwind CSS
- Radix UI
- Recharts
- lucide-react

### Backend

- Node.js
- Express
- Stellar SDK
- Horizon Testnet
- Supabase

### Blockchain / Settlement

- Stellar Testnet
- Stellar SDK
- Stellar Expert
- XLM testnet payments
- EPWR testnet asset support

### Infrastructure

- Vercel
- Supabase
- GitHub

---

## Implemented Technical Capabilities

The current implementation includes:

- authenticated settlement route;
- role-based settlement authorization;
- Stellar Testnet transaction creation;
- backend-side transaction signing;
- Horizon transaction submission;
- txHash and ledger capture;
- Stellar Expert link generation;
- settlement memo support;
- destination public key validation;
- supported asset validation;
- Supabase settlement persistence;
- x402-compatible HTTP 402 payment flow;
- payment proof validation through Horizon;
- frontend execution logs;
- audit-oriented UI.

---

## Stellar Testnet Evidence

EnergyPay uses Stellar Testnet to provide verifiable settlement evidence.

Each successful settlement can generate:

- transaction hash;
- ledger number;
- source public key;
- destination public key;
- memo;
- amount;
- asset;
- status;
- finality time;
- Stellar Expert transaction URL.

This allows reviewers, partners and stakeholders to independently verify settlement execution.

---

## Security Notes

EnergyPay is currently a testnet MVP and should not be used for production financial settlement.

Current security-oriented decisions include:

- backend-side transaction signing;
- no private key exposure in frontend execution flows;
- environment-based secret management;
- role-based authorization for settlement execution;
- Stellar public key validation;
- amount and asset validation;
- explicit separation between testnet MVP and production/mainnet operations.

Future production versions would require:

- formal security audit;
- stronger custody architecture;
- regulated compliance review;
- KYC/KYB workflows;
- production-grade key management;
- mainnet readiness review;
- banking/fiat integration assessment;
- legal and regulatory validation.

---

## What Is In Scope Now

The current EnergyPay MVP focuses on:

- digital energy contract registration;
- Stellar Testnet settlement execution;
- Direct Settlement flow;
- txHash, ledger and memo evidence;
- Stellar Expert verification;
- audit dashboard;
- settlement lifecycle visualization;
- x402-compatible API access demonstration;
- demo-ready operational interface.

---

## What Is Not In Scope Yet

The current MVP does not claim to provide:

- production mainnet settlement;
- regulated financial operations;
- real-money energy market settlement;
- full clearing house operation;
- collateral management;
- margin engine;
- netting engine;
- banking integration;
- PIX integration;
- ERP integration;
- formal security audit;
- licensed financial intermediation.

These are future roadmap areas that require additional technical, legal, financial and compliance work.

---

## Roadmap

### Phase 1 — MVP Settlement Infrastructure

- Digital contract registry
- Stellar Testnet settlement rail
- Direct Settlement
- Audit dashboard
- Transaction evidence package

### Phase 2 — Institutional Refinement

- Improved contract lifecycle
- Enhanced reconciliation workflows
- Better audit evidence exports
- Stakeholder-facing dashboards
- Pilot-ready documentation

### Phase 3 — Programmable Contract Logic

- Soroban-based settlement logic exploration
- Programmable contract conditions
- Automated settlement triggers
- On-chain/off-chain contract coordination

### Phase 4 — Treasury & Risk Layer

- Collateral monitoring
- Treasury operations
- Reserve management
- Counterparty exposure views
- Settlement risk analytics

### Phase 5 — Production Readiness

- Security audit
- Mainnet planning
- Compliance review
- Enterprise integrations
- Market pilot preparation

### Phase 6 — Energy Financial Infrastructure

- Stablecoin settlement rails
- Energy API monetization
- Machine-to-machine payments
- Oracle-based settlement triggers
- Energy financial products
- Cross-market interoperability

---

## Market Vision

EnergyPay is designed for a future where electricity contracts become programmable financial primitives.

The long-term vision is to support infrastructure for:

- energy traders;
- generators;
- retailers;
- distributors;
- commercial consumers;
- financial institutions;
- energy service providers;
- market operators;
- API-based energy data providers;
- autonomous energy systems.

As energy markets become more dynamic and decentralized, settlement infrastructure must become faster, more transparent and more programmable.

---

## Why Stellar

Stellar provides a strong foundation for EnergyPay because it is optimized for fast, low-cost and verifiable financial transactions.

EnergyPay uses Stellar to demonstrate:

- programmable settlement execution;
- fast transaction confirmation;
- public transaction verification;
- ledger-based auditability;
- interoperable payment infrastructure;
- future stablecoin and asset-based settlement rails.

Stellar acts as the financial execution rail, while EnergyPay provides the energy-specific workflow, registry, audit and reconciliation layer.

---

## Team

EnergyPay is being developed by:

**Roberto Pimentel**  
Fullstack & Web3 Developer  
Technical Lead / Builder

**Eduardo Ferreira**  
Energy Market & Commercial Strategy  
Market Validation / Business Lead

---

## Project Status

EnergyPay is currently in active development.

Current status:

- MVP operational;
- Stellar Testnet settlement working;
- Direct Settlement flow implemented;
- x402-compatible API flow implemented;
- institutional frontend deployed on Vercel;
- audit-oriented workflow in place;
- stakeholder validation initiated with energy market participants;
- Instawards SOW and pilot documentation in progress.

---

## Disclaimer

EnergyPay is currently an experimental MVP running on Stellar Testnet.

The platform is intended for demonstration, validation and technical development purposes only.

It does not currently perform regulated financial settlement, does not operate with production funds and does not represent a licensed clearing house, payment institution or energy market operator.

---

## EnergyPay

**Building the programmable financial rail for electricity markets.**
