# EnergyPay x402-Compatible API Flow

## Overview

This document explains the x402-compatible API access flow implemented in the current EnergyPay MVP.

EnergyPay is primarily focused on programmable settlement and reconciliation infrastructure for energy contracts. The x402-compatible module is an adjacent innovation layer that demonstrates how future paid energy APIs, oracle feeds and market data services could be monetized through programmable payment proofs.

The current implementation uses Stellar Testnet transactions as verifiable payment proofs for API access.

---

## Current Scope

The current x402-compatible flow is designed for MVP validation and demonstration purposes.

It demonstrates:

- a protected energy market API resource;
- HTTP 402 Payment Required response;
- payment requirement metadata;
- Stellar Testnet payment proof using txHash;
- backend verification through Horizon;
- memo, destination and amount validation;
- access granted after payment proof verification.

This implementation is not positioned as the core EnergyPay settlement engine. It is a complementary module for future API monetization.

---

## Why x402 Matters for EnergyPay

Energy markets increasingly depend on data, automation and API-based workflows.

Future energy infrastructure may require paid machine-readable access to:

- market data;
- settlement status;
- audit evidence;
- oracle feeds;
- PLD or pricing references;
- reconciliation outputs;
- operational telemetry;
- automated settlement triggers.

The x402-compatible module explores how EnergyPay could monetize protected API resources using programmable payments.

---

## High-Level Flow

```txt
User requests protected API resource
        ↓
Backend returns HTTP 402 Payment Required
        ↓
Frontend displays payment requirement
        ↓
User provides Stellar Testnet payment proof
        ↓
Backend verifies txHash through Horizon
        ↓
Backend validates memo, destination, amount and success
        ↓
API access is granted
        ↓
Frontend displays premium energy market data
```

---

## Protected Resource

The current MVP demonstrates a protected API resource for premium energy market data.

Example protected resource:

```txt
/api/x402/pld
```

The PLD feed is used as a demonstration of how premium energy market data could require payment before access.

The current data is for MVP demonstration and should not be interpreted as production-grade market data.

---

## HTTP 402 Payment Required

When a user requests the protected resource without payment proof, the backend returns an HTTP 402 response.

The response indicates that payment is required before access can be granted.

The backend also returns payment requirement metadata that the frontend can display to the user.

Example payment requirement fields:

```txt
scheme
network
asset
amount
destination
memo
description
resource
```

---

## Payment Requirement

A payment requirement tells the client what payment must be made before the protected resource can be accessed.

In the current MVP, a payment requirement may include:

```json
{
  "scheme": "stellar-testnet",
  "network": "stellar-testnet",
  "asset": "XLM",
  "amount": "0.0001",
  "destination": "G...",
  "memo": "X402-PLD",
  "description": "EnergyPay premium PLD market data API access",
  "resource": "/api/x402/pld"
}
```

The user or client must provide proof of a Stellar Testnet transaction matching these requirements.

---

## Payment Proof

The current MVP uses a Stellar Testnet transaction hash as payment proof.

The payment proof is submitted through a request header:

```txt
PAYMENT-SIGNATURE: stellar-testnet:<txHash>
```

Example:

```txt
PAYMENT-SIGNATURE: stellar-testnet:PASTE_TX_HASH_HERE
```

The backend extracts the txHash and verifies it through Horizon Testnet.

---

## Backend Verification

After receiving the payment proof, the backend checks the Stellar Testnet transaction.

Verification includes:

- checking that the txHash exists;
- checking that the transaction was successful;
- checking that the memo matches the expected memo;
- checking that the transaction contains a matching payment operation;
- checking that the destination matches the payment requirement;
- checking that the amount is greater than or equal to the required amount;
- checking that the asset matches the expected asset.

If the payment proof is valid, the backend grants access to the protected resource.

If verification fails, the backend returns a payment-required or verification-failed response.

---

## Access Granted Response

When payment verification succeeds, the backend returns access to the protected data.

A successful response may include:

```json
{
  "status": "ACCESS_GRANTED",
  "protocol": "x402-compatible",
  "network": "stellar-testnet",
  "resource": "premium-pld-feed",
  "payment": {
    "ok": true,
    "txHash": "example_tx_hash",
    "ledger": 123456,
    "from": "G...",
    "to": "G...",
    "asset": "XLM",
    "amount": "0.0001",
    "memo": "X402-PLD",
    "explorer_url": "https://stellar.expert/explorer/testnet/tx/example_tx_hash"
  },
  "data": {
    "market": "Brazil Free Energy Market",
    "subsystem": "SE/CO",
    "pld_brl_mwh": 173.42,
    "settlement_window": "D+0 simulated",
    "source": "EnergyPay Oracle Simulation"
  }
}
```

The response connects the API access event to verifiable Stellar Testnet payment evidence.

---

## Frontend Flow

The frontend x402 page demonstrates the full interaction.

The user can:

1. check x402 status;
2. request the protected PLD feed without payment proof;
3. receive HTTP 402 Payment Required metadata;
4. view the required asset, amount, memo and destination;
5. paste a Stellar Testnet txHash;
6. retry the API request with the payment proof header;
7. receive access granted after backend verification;
8. inspect ledger, amount, source, destination and Stellar Expert link.

---

## x402 Status Endpoint

The current MVP may expose a status endpoint such as:

```txt
/api/x402/status
```

This endpoint can return:

- protocol status;
- network;
- protected resource;
- payment requirement metadata.

This helps the frontend display the current payment requirement before requesting the protected resource.

---

## Data Flow

```txt
Frontend
x402 API Access Page
        ↓
GET /api/x402/status
        ↓
Backend returns payment requirement metadata
        ↓
GET /api/x402/pld without payment proof
        ↓
Backend returns HTTP 402 Payment Required
        ↓
User provides Stellar Testnet txHash
        ↓
GET /api/x402/pld with PAYMENT-SIGNATURE header
        ↓
Backend verifies txHash through Horizon
        ↓
Backend grants access if payment is valid
        ↓
Frontend displays premium PLD data and payment evidence
```

---

## Relationship to EnergyPay Core Settlement

The x402-compatible module is not the core settlement infrastructure.

EnergyPay core focuses on:

- digital energy contract obligations;
- settlement instructions;
- Stellar Testnet settlement execution;
- transaction evidence;
- audit and reconciliation workflows.

The x402-compatible module demonstrates a future monetization path for:

- paid APIs;
- premium data access;
- oracle feeds;
- automated market data services;
- programmable API consumption.

This separation is important because the EnergyPay MVP should be understood primarily as settlement and reconciliation infrastructure.

---

## What Is Real

The current x402-compatible MVP can demonstrate:

- HTTP 402 Payment Required response;
- payment requirement metadata;
- Stellar Testnet txHash as payment proof;
- Horizon-based transaction verification;
- memo validation;
- destination validation;
- amount validation;
- access granted after valid proof;
- frontend execution logs;
- Stellar Expert link for payment verification.

---

## What Is Simulated or MVP-Scoped

The current x402-compatible flow may include simulated or MVP-scoped elements such as:

- simulated PLD data;
- testnet-only payment;
- demo payment destination;
- non-production payment verification;
- simplified payment proof format;
- no production billing;
- no regulated financial activity.

This is acceptable for MVP validation as long as it is clearly presented as an experimental testnet module.

---

## What Is Not Claimed

EnergyPay does not currently claim that the x402-compatible module is:

- a production billing system;
- a regulated payment product;
- a full commercial API gateway;
- a mainnet payment system;
- a final implementation of production API monetization;
- a substitute for compliance, billing, taxation or financial controls.

The current implementation is a technical demonstration of payment-gated API access using Stellar Testnet evidence.

---

## Security Boundaries

The current x402-compatible module follows testnet MVP boundaries.

Security-oriented notes:

- no production funds are used;
- verification is performed through Horizon Testnet;
- payment proof is based on txHash inspection;
- expected memo, destination and amount are validated;
- secrets must remain server-side;
- testnet accounts should be treated as disposable;
- production use would require stronger billing, replay protection, identity, compliance and monitoring.

---

## Environment Variables

The x402-compatible flow may use environment variables such as:

```txt
X402_RECEIVER_PUBLIC_KEY=
X402_PRICE_XLM=
X402_MEMO=
STELLAR_DESTINATION=
```

Rules:

- do not commit real secret values;
- use testnet public keys and testnet configuration for MVP validation;
- keep sensitive values in environment variables;
- rotate exposed credentials immediately;
- design a stronger payment and billing architecture before production usage.

---

## Reviewer Checklist

A reviewer can validate the x402-compatible flow by checking:

- Does the frontend include an x402 API access page?
- Does the protected resource return HTTP 402 without payment proof?
- Does the backend return payment requirement metadata?
- Does the frontend display asset, amount, memo and destination?
- Can a Stellar Testnet txHash be submitted as payment proof?
- Does the backend verify the transaction through Horizon?
- Does the backend check memo, destination, amount and success?
- Does the response return ACCESS_GRANTED after valid proof?
- Does the response include a Stellar Expert link?
- Is the module clearly separated from production billing claims?

---

## Example Evidence Template

Use this template to document one x402-compatible verification example.

```txt
Protected Resource:
/api/x402/pld

Required Asset:
XLM

Required Amount:
PASTE_AMOUNT_HERE

Required Destination:
PASTE_DESTINATION_PUBLIC_KEY_HERE

Required Memo:
PASTE_MEMO_HERE

Payment Proof Header:
PAYMENT-SIGNATURE: stellar-testnet:<txHash>

Transaction Hash:
PASTE_TX_HASH_HERE

Ledger:
PASTE_LEDGER_NUMBER_HERE

Stellar Expert Link:
PASTE_STELLAR_EXPERT_LINK_HERE

Verification Result:
ACCESS_GRANTED
```

---

## Future Direction

Future versions of this module could evolve toward:

- production-grade API billing;
- stablecoin-based API payments;
- reusable payment sessions;
- replay protection;
- customer-specific API keys;
- usage-based metering;
- oracle feed monetization;
- settlement evidence APIs;
- machine-to-machine energy market workflows;
- enterprise integration with billing and accounting systems.

These future directions are outside the current MVP scope.

---

## Summary

The EnergyPay x402-compatible module demonstrates how a protected energy market API can be unlocked through verifiable Stellar Testnet payment evidence.

```txt
Protected API Request
        ↓
HTTP 402 Payment Required
        ↓
Stellar Testnet Payment Proof
        ↓
Horizon Verification
        ↓
ACCESS_GRANTED
        ↓
Premium Energy API Response
```

This module supports the broader EnergyPay thesis by showing how programmable payment infrastructure can extend beyond settlement execution into future paid data and automation services.
