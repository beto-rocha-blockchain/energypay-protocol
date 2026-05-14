import {
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  Asset,
  Horizon,
} from "@stellar/stellar-sdk";

import dotenv from "dotenv";

dotenv.config();

// ========================================
// Stellar Horizon Server
// ========================================

const server = new Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

// ========================================
// Accounts
// ========================================

const issuerKeypair = Keypair.fromSecret(
  process.env.ISSUER_SECRET
);

const distributionKeypair = Keypair.fromSecret(
  process.env.DISTRIBUTION_SECRET
);

// ========================================
// EPWR Asset
// ========================================

export const EPWR_ASSET = new Asset(
  "EPWR",
  issuerKeypair.publicKey()
);

// ========================================
// Create Trustline
// Distribution accepts EPWR
// ========================================

export async function createTrustline() {
  try {

    const account = await server.loadAccount(
      distributionKeypair.publicKey()
    );

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: EPWR_ASSET,
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "trustline-created",
      hash: result.hash,
      ledger: result.ledger,
    };

  } catch (error) {

    console.error("Trustline Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// ========================================
// Mint EPWR Tokens
// Issuer sends tokens to Distribution
// ========================================

export async function mintEPWR(amount = "1000") {
  try {

    const issuerAccount = await server.loadAccount(
      issuerKeypair.publicKey()
    );

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: distributionKeypair.publicKey(),
          asset: EPWR_ASSET,
          amount: amount.toString(),
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-minted",
      amount,
      hash: result.hash,
      ledger: result.ledger,
    };

  } catch (error) {

    console.error("Mint Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// ========================================
// Send EPWR to User
// ========================================

export async function sendEPWR(destination, amount = "10") {
  try {

    const distributionAccount = await server.loadAccount(
      distributionKeypair.publicKey()
    );

    const transaction = new TransactionBuilder(distributionAccount, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: EPWR_ASSET,
          amount: amount.toString(),
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-transfer",
      amount,
      destination,
      hash: result.hash,
      ledger: result.ledger,
    };

  } catch (error) {

    console.error("Transfer Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// ========================================
// Get Distribution Balances
// ========================================

export async function getDistributionBalances() {
  try {

    const account = await server.loadAccount(
      distributionKeypair.publicKey()
    );

    return {
      success: true,
      account: distributionKeypair.publicKey(),
      balances: account.balances,
    };

  } catch (error) {

    console.error("Balance Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// ========================================
// Get Issuer Public Address
// ========================================

export function getIssuerAddress() {
  return issuerKeypair.publicKey();
}

// ========================================
// Get Distribution Public Address
// ========================================

export function getDistributionAddress() {
  return distributionKeypair.publicKey();
}