# EnergyPay Grant Scope

## Overview

This document defines the current grant-oriented scope for EnergyPay.

EnergyPay is a programmable settlement and reconciliation infrastructure for energy contracts, using Stellar Testnet as a verifiable financial execution rail for MVP validation.

The current grant scope focuses on a clear, reviewable and execution-oriented MVP that demonstrates how bilateral energy settlement obligations can be represented, executed, verified and audited through a Stellar-based workflow.

---

## Grant Objective

The objective of the current grant scope is to refine and demonstrate EnergyPay as a working MVP for programmable settlement infrastructure in energy markets.

At the end of the scoped execution period, EnergyPay should provide:

- a digital energy contract registry flow;
- a Stellar Testnet settlement execution flow;
- transaction evidence through txHash, ledger, memo and Stellar Expert links;
- an audit-oriented dashboard or evidence package;
- clear documentation for reviewers;
- demo video or walkthrough;
- public GitHub repository;
- deployed frontend demo.

---

## Problem Being Addressed

Bilateral energy contract settlement remains operationally fragmented.

Energy market participants often deal with:

- manual reconciliation;
- spreadsheet-based controls;
- delayed settlement confirmation;
- disconnected financial workflows;
- limited audit evidence;
- counterparty risk;
- lack of programmable execution;
- difficulty connecting contract obligations to payment execution.

EnergyPay addresses this gap by demonstrating how energy settlement obligations can be connected to verifiable financial execution on Stellar Testnet.

---

## Current MVP Thesis

EnergyPay is not positioned as a generic blockchain or tokenization project.

The MVP thesis is:

Energy settlement workflows can become more transparent, auditable and programmable when contract obligations are connected to verifiable financial execution rails.

In the current MVP:

- EnergyPay provides the application and workflow layer;
- Stellar Testnet provides the verifiable financial execution layer;
- Supabase provides MVP audit persistence;
- Stellar Expert provides external transaction verification.

---

## In-Scope Deliverables

The current grant scope is organized around three main deliverables.

---

## 1. Digital Energy Contract Registry MVP

### Description

A web module that allows users to represent and visualize a bilateral energy settlement obligation.

The registry may include fields such as:

- buyer;
- seller;
- energy volume;
- reference price;
- settlement date;
- contract reference;
- lifecycle status;
- settlement status.

### Why It Matters

The registry creates the digital contract layer required before settlement execution.

It allows EnergyPay to model the obligation that will later be settled through the platform.

### Expected Evidence

Evidence may include:

- deployed frontend screens;
- GitHub implementation;
- screenshots;
- demo video;
- sample contract records;
- contract lifecycle states.

---

## 2. Stellar Testnet Programmable Settlement Rail

### Description

A Stellar Testnet settlement flow that executes a simulated energy settlement and returns verifiable transaction evidence.

The settlement flow should capture:

- source wallet;
- destination wallet;
- asset;
- amount;
- transaction hash;
- ledger number;
- memo;
- finality latency;
- status;
- Stellar Expert link.

### Why It Matters

This deliverable proves that EnergyPay can connect a digital settlement obligation to a verifiable financial execution rail.

It also demonstrates that the MVP is not only a visual interface, but a working testnet settlement flow.

### Expected Evidence

Evidence may include:

- txHash examples;
- ledger numbers;
- Stellar Expert links;
- settlement receipt in the frontend;
- backend route implementation;
- demo video;
- audit record persistence.

---

## 3. Settlement Dashboard and Audit Evidence Package

### Description

A dashboard and documentation package showing the settlement lifecycle and supporting reviewable evidence.

The dashboard and evidence package should help users and reviewers understand:

- what settlement was initiated;
- which contract or operation it relates to;
- what transaction was executed;
- what txHash was generated;
- which ledger confirmed the transaction;
- where the transaction can be verified externally;
- what status the settlement reached.

### Why It Matters

Energy settlement is not only about payment execution. It also requires reconciliation, auditability and operational confidence.

This deliverable shows how EnergyPay can reduce reconciliation friction by connecting platform-level records with external Stellar transaction evidence.

### Expected Evidence

Evidence may include:

- `docs/EVIDENCE.md`;
- Stellar Expert transaction links;
- demo video;
- screenshots;
- audit records;
- settlement dashboard;
- README;
- GitHub repository.

---

## Out-of-Scope Items

The current grant scope intentionally excludes production and regulated activities.

The following are not part of the current grant scope:

- production mainnet launch;
- real-money financial settlement;
- live energy market settlement;
- regulated clearing house activity;
- banking integration;
- PIX integration;
- ERP integration;
- formal security audit;
- production custody;
- collateral engine;
- margin engine;
- netting engine;
- full treasury infrastructure;
- legal or regulatory approval;
- KYC/KYB operations.

These items may be considered in future phases after technical validation, security review, legal review and market pilot design.

---

## Current Implemented Capabilities

The current EnergyPay MVP already includes or demonstrates:

- institutional frontend deployed on Vercel;
- Direct Settlement flow;
- Stellar Testnet transaction submission;
- txHash return;
- ledger confirmation;
- memo support;
- Stellar Expert link generation;
- audit-oriented settlement records;
- x402-compatible API access flow;
- backend settlement services;
- role-based settlement authorization;
- Supabase-based MVP persistence;
- stakeholder validation initiated with energy market participants.

---

## MVP Validation Boundaries

The current system is designed for MVP validation only.

EnergyPay currently runs in a testnet and simulated environment.

The MVP may include:

- testnet wallets;
- testnet XLM;
- EPWR testnet asset support;
- simulated contract data;
- simulated PLD or market data;
- demo counterparties;
- non-production signing architecture;
- audit-oriented MVP persistence.

This is acceptable for grant and hackathon validation as long as the documentation clearly separates implemented testnet functionality from future production claims.

---

## Evidence Requirements

The project should provide clear evidence for each deliverable.

Recommended evidence includes:

- public GitHub repository;
- live deployed demo;
- demo video;
- README;
- architecture documentation;
- evidence package;
- Stellar Testnet transaction hashes;
- ledger numbers;
- Stellar Expert links;
- screenshots;
- settlement receipts;
- x402-compatible flow demonstration.

---

## Reviewer Verification Flow

A reviewer should be able to validate the project by following this path:

1. Open the GitHub repository.
2. Read the README.
3. Open the live demo.
4. Review the Direct Settlement flow.
5. Inspect a settlement receipt.
6. Copy the txHash or open the Stellar Expert link.
7. Verify the transaction on Stellar Testnet.
8. Confirm the ledger, memo, amount and destination.
9. Review `docs/EVIDENCE.md`.
10. Review `docs/ARCHITECTURE.md`.
11. Review `docs/STELLAR_TESTNET_FLOW.md`.
12. Review the x402-compatible API flow if applicable.

---

## Success Criteria

The current grant scope should be considered successful if EnergyPay can demonstrate:

- a working MVP interface;
- a clear settlement workflow;
- Stellar Testnet execution;
- verifiable transaction evidence;
- audit-oriented settlement record;
- documentation explaining implementation and scope;
- clear separation between MVP/testnet and future production vision;
- credible roadmap for further development.

---

## Suggested 30-Day Execution Plan

### Week 1 — Scope Refinement and Contract Registry

Focus:

- refine MVP scope;
- organize repository documentation;
- improve contract registry flow;
- align frontend and backend assumptions;
- document current architecture.

Expected output:

- stable repository baseline;
- improved README;
- architecture documentation;
- contract registry flow ready for settlement integration.

---

### Week 2 — Stellar Testnet Settlement Rail

Focus:

- improve Direct Settlement flow;
- validate transaction evidence;
- ensure txHash, ledger, memo and Stellar Expert links are visible;
- improve backend error handling;
- document Stellar Testnet flow.

Expected output:

- reliable testnet settlement execution;
- settlement receipts;
- Stellar Expert verification;
- `docs/STELLAR_TESTNET_FLOW.md`.

---

### Week 3 — Audit and Evidence Layer

Focus:

- improve settlement history;
- document evidence package;
- validate audit persistence;
- clarify real vs simulated data;
- prepare reviewer walkthrough.

Expected output:

- `docs/EVIDENCE.md`;
- audit evidence examples;
- demo-ready settlement flow;
- reviewer checklist.

---

### Week 4 — Final Demo and Submission Package

Focus:

- bug fixing;
- UI polish;
- documentation review;
- demo recording;
- final screenshots;
- grant submission package.

Expected output:

- live demo;
- final GitHub repository;
- demo video;
- evidence package;
- transaction examples;
- final submission-ready documentation.

---

## Future Follow-On Scope

Future grant or development phases may include:

- Soroban-based programmable settlement logic;
- stronger contract lifecycle management;
- reconciliation exports;
- enterprise user management;
- organization-level permissions;
- production-grade observability;
- stablecoin settlement exploration;
- collateral and treasury modules;
- pilot preparation with market stakeholders;
- security audit preparation;
- mainnet readiness planning.

These are future phases and should not be confused with the current MVP scope.

---

## Grant Communication Guidelines

When presenting EnergyPay for grants or hackathon review, the recommended framing is:

EnergyPay is a programmable settlement and reconciliation infrastructure MVP for energy contracts, using Stellar Testnet to demonstrate verifiable settlement execution and audit evidence.

Avoid overclaiming:

- do not claim production settlement;
- do not claim regulated clearing house status;
- do not claim live energy market settlement;
- do not claim mainnet readiness;
- do not claim banking or PIX integration;
- do not claim formal compliance approval.

Use precise language:

- Stellar Testnet settlement;
- MVP validation;
- verifiable transaction evidence;
- audit-oriented workflow;
- programmable settlement infrastructure;
- future production roadmap.

---

## Current Documentation Set

The current documentation package should include:

- `README.md`;
- `docs/EVIDENCE.md`;
- `docs/ARCHITECTURE.md`;
- `docs/STELLAR_TESTNET_FLOW.md`;
- `docs/X402_FLOW.md`;
- `docs/SECURITY.md`;
- `docs/GRANT_SCOPE.md`.

Additional future documents may include:

- `docs/VALIDATION.md`;
- `docs/ROADMAP.md`;
- `docs/API_REFERENCE.md`;
- `docs/DEPLOYMENT.md`.

---

## Summary

The current EnergyPay grant scope is intentionally focused.

It does not attempt to build a full production clearing house, regulated financial institution or complete energy market infrastructure.

Instead, it demonstrates a realistic and reviewable MVP:

```txt
Energy Contract Obligation
        ↓
Digital Registry
        ↓
Settlement Instruction
        ↓
Stellar Testnet Execution
        ↓
txHash + Ledger + Memo
        ↓
Audit Evidence
        ↓
Reviewer Verification
```

This scope is aligned with short-cycle grant execution because it is specific, demonstrable and verifiable within a limited development period.
