# EnergyPay Evidence Package

## Overview

This document provides the evidence package for the current EnergyPay MVP.

EnergyPay is a programmable settlement and reconciliation infrastructure for energy contracts, using Stellar Testnet as a verifiable financial execution rail for MVP validation.

The purpose of this document is to help reviewers, judges, mentors, grant evaluators and stakeholders verify what has already been implemented, what is currently simulated, and what remains part of the future roadmap.

---

## Project Links

### Live Demo

[EnergyPay Live Demo](https://energypay-protocol.vercel.app/)

### GitHub Repository

[energypay-protocol](https://github.com/beto-rocha-blockchain/energypay-protocol)

### Demo Video

Add demo video link here:

```txt
PASTE_LOOM_OR_DRIVE_LINK_HERE
```

### Institutional Video

Add institutional video link here:

```txt
PASTE_VIDEO_LINK_HERE
```

---

## Evidence Summary

The current EnergyPay MVP demonstrates:

- digital representation of bilateral energy settlement obligations;
- settlement execution through Stellar Testnet;
- transaction hash generation;
- ledger number confirmation;
- memo-based settlement identification;
- Stellar Expert transaction verification;
- audit-oriented settlement history;
- x402-compatible API payment proof flow;
- institutional frontend deployed on Vercel;
- backend settlement execution using Stellar SDK and Horizon Testnet.

---

## What Is Real in the Current MVP

The following components are implemented and demonstrable in the current MVP:

### 1. Live Frontend

EnergyPay has a deployed institutional frontend showing operational modules such as:

- settlement operations;
- direct settlement;
- contract-related screens;
- x402-compatible API access;
- audit-oriented views;
- treasury/operations interface concepts.

Evidence:

```txt
https://energypay-protocol.vercel.app/
```

---

### 2. Stellar Testnet Settlement Execution

The backend submits settlement transactions to Stellar Testnet.

Each successful settlement can return:

- transaction hash;
- ledger number;
- source public key;
- destination public key;
- asset;
- amount;
- memo;
- finality time;
- status;
- Stellar Expert explorer link.

Evidence to include:

```txt
Example txHash:
PASTE_TX_HASH_HERE

Example ledger:
PASTE_LEDGER_NUMBER_HERE

Stellar Expert link:
PASTE_STELLAR_EXPERT_LINK_HERE
```

---

### 3. Direct Settlement Flow

The Direct Settlement module demonstrates a payment execution flow where a user can submit settlement information and receive verifiable transaction evidence.

The current MVP supports:

- destination wallet input;
- settlement amount;
- memo;
- Stellar Testnet transaction submission;
- txHash return;
- ledger confirmation;
- explorer link generation;
- audit-style receipt.

Evidence to include:

```txt
Direct Settlement demo timestamp:
PASTE_VIDEO_TIMESTAMP_HERE

Example destination wallet:
PASTE_TESTNET_PUBLIC_KEY_HERE

Example memo:
PASTE_MEMO_HERE

Example txHash:
PASTE_TX_HASH_HERE
```

---

### 4. Stellar Expert Verification

EnergyPay settlement transactions can be independently verified through Stellar Expert on Testnet.

Reviewers can inspect:

- transaction status;
- ledger;
- source account;
- destination account;
- asset;
- amount;
- memo;
- operation details.

Evidence to include:

```txt
Stellar Expert transaction URL:
PASTE_STELLAR_EXPERT_TRANSACTION_URL_HERE
```

---

### 5. Audit-Oriented Settlement Evidence

The MVP includes an audit-oriented workflow designed to help users inspect settlement lifecycle information.

The current evidence model includes:

- settlement ID;
- contract reference;
- buyer/seller or source/destination;
- amount;
- transaction hash;
- ledger;
- status;
- timestamp;
- memo;
- explorer link.

This supports operational reconciliation by connecting a settlement event inside EnergyPay with an externally verifiable Stellar transaction.

---

### 6. x402-Compatible API Access Flow

EnergyPay includes an experimental x402-compatible flow for paid energy market API access.

The current x402-compatible flow demonstrates:

1. a protected API resource;
2. HTTP 402 Payment Required response;
3. payment requirement metadata;
4. Stellar Testnet payment proof using txHash;
5. backend verification through Horizon;
6. access granted after payment proof validation.

Evidence to include:

```txt
x402 demo timestamp:
PASTE_VIDEO_TIMESTAMP_HERE

Protected API resource:
/api/x402/pld

Payment proof format:
PAYMENT-SIGNATURE: stellar-testnet:<txHash>

Example txHash used for x402 verification:
PASTE_TX_HASH_HERE
```

---

## What Is Simulated in the Current MVP

The current MVP uses simulated or testnet-based data for demonstration purposes.

The following items are not production operations:

- real-money energy settlement;
- mainnet financial settlement;
- regulated clearing house activity;
- production custody;
- live bank integration;
- PIX integration;
- ERP integration;
- regulated market operator integration;
- production energy market settlement.

Some operational dashboards and market data views may include simulated values to demonstrate the intended user experience and workflow.

---

## What Is Not Claimed

EnergyPay does not currently claim to be:

- a licensed clearing house;
- a regulated payment institution;
- a production financial intermediary;
- a live energy market operator;
- a mainnet settlement platform;
- a banking or PIX provider;
- a substitute for legal, regulatory or compliance infrastructure.

The current implementation is a Stellar Testnet MVP intended for technical validation, market discovery and grant/hackathon evaluation.

---

## Testnet Evidence Checklist

Before submitting this evidence package, include at least one complete settlement example.

### Settlement Example 1

```txt
Settlement ID:
PASTE_SETTLEMENT_ID_HERE

Contract Reference:
PASTE_CONTRACT_REFERENCE_HERE

Source Public Key:
PASTE_SOURCE_PUBLIC_KEY_HERE

Destination Public Key:
PASTE_DESTINATION_PUBLIC_KEY_HERE

Asset:
XLM or EPWR

Amount:
PASTE_AMOUNT_HERE

Memo:
PASTE_MEMO_HERE

Transaction Hash:
PASTE_TX_HASH_HERE

Ledger:
PASTE_LEDGER_NUMBER_HERE

Status:
FINALIZED / SETTLED

Stellar Expert Link:
PASTE_STELLAR_EXPERT_LINK_HERE
```

---

### Settlement Example 2

```txt
Settlement ID:
PASTE_SETTLEMENT_ID_HERE

Contract Reference:
PASTE_CONTRACT_REFERENCE_HERE

Source Public Key:
PASTE_SOURCE_PUBLIC_KEY_HERE

Destination Public Key:
PASTE_DESTINATION_PUBLIC_KEY_HERE

Asset:
XLM or EPWR

Amount:
PASTE_AMOUNT_HERE

Memo:
PASTE_MEMO_HERE

Transaction Hash:
PASTE_TX_HASH_HERE

Ledger:
PASTE_LEDGER_NUMBER_HERE

Status:
FINALIZED / SETTLED

Stellar Expert Link:
PASTE_STELLAR_EXPERT_LINK_HERE
```

---

## Suggested Reviewer Flow

A reviewer can validate the current MVP by following this flow:

1. Open the live demo.
2. Access the Direct Settlement module.
3. Execute or inspect a settlement flow.
4. Capture the returned txHash and ledger number.
5. Open the Stellar Expert transaction link.
6. Verify the transaction on Stellar Testnet.
7. Confirm memo, amount, source, destination and transaction status.
8. Review the audit-oriented settlement evidence in the platform.
9. Open the x402-compatible page.
10. Request the protected API resource.
11. Verify the HTTP 402 payment flow.
12. Submit a valid Stellar Testnet txHash as payment proof.
13. Confirm access is granted after Horizon validation.

---

## Technical Evidence

The implementation includes the following technical components:

### Backend

- Node.js;
- Express;
- Stellar SDK;
- Horizon Testnet;
- settlement execution route;
- role-based settlement authorization;
- controlled server-side signing for Stellar Testnet MVP validation;
- transaction submission;
- error handling;
- txHash and ledger return;
- Supabase persistence.

### Frontend

- React;
- TypeScript;
- Vite;
- TanStack Router / TanStack Start;
- Zustand;
- Tailwind CSS;
- operational dashboard UI;
- Direct Settlement flow;
- x402-compatible API access page;
- transaction evidence display.

### Blockchain Layer

- Stellar Testnet;
- Horizon;
- Stellar Expert;
- XLM testnet settlement;
- EPWR testnet asset support.

---

## Security and Compliance Boundaries

The MVP is intentionally limited to testnet validation.

Current security-oriented design choices include:

- no production funds;
- no mainnet settlement;
- no regulated financial activity;
- no client-side private key exposure in the demonstrated execution flow;
- controlled server-side signing for Stellar Testnet MVP validation;
- environment-based secret management;
- destination public key validation;
- amount validation;
- role-based authorization for settlement execution.

Future production versions would require:

- formal security audit;
- production-grade custody architecture;
- key management review;
- legal and regulatory review;
- KYC/KYB processes;
- mainnet deployment strategy;
- banking or payment partner integration;
- compliance framework for the target jurisdiction.

---

## Current Status

EnergyPay currently has:

- MVP operational;
- live frontend deployed on Vercel;
- Stellar Testnet settlement working;
- Direct Settlement flow implemented;
- x402-compatible API access flow implemented;
- audit-oriented workflow in place;
- stakeholder validation initiated with energy market participants;
- Instawards SOW and pilot documentation in progress.

---

## Evidence To Add Before Final Submission

Before using this document in a grant or hackathon submission, replace all placeholder values with real evidence:

- demo video link;
- institutional video link;
- txHash examples;
- ledger numbers;
- Stellar Expert links;
- screenshots, if available;
- relevant demo timestamps;
- wallet addresses used in Testnet;
- settlement memo examples;
- x402 payment proof example.

---

## Final Note

EnergyPay is currently an experimental MVP running on Stellar Testnet.

The project demonstrates how programmable financial infrastructure can improve the way bilateral energy settlement obligations are executed, verified and reconciled.

The current evidence package is intended to support transparent technical review and distinguish implemented functionality from future roadmap items.
