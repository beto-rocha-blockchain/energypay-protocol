/**
 * Centralized Stellar network configuration.
 *
 * Reads STELLAR_NETWORK from process.env to determine whether the platform
 * operates on the public mainnet or the testnet.
 *
 *   STELLAR_NETWORK=mainnet  → Stellar public network
 *   STELLAR_NETWORK=testnet  → Stellar test network (default)
 *
 * Every backend service and route MUST import from this module instead of
 * hard-coding Horizon URLs, network passphrases, or explorer base URLs.
 */

import { Horizon, Networks } from "@stellar/stellar-sdk";

const raw = (process.env.STELLAR_NETWORK || "testnet").toLowerCase().trim();
export const IS_MAINNET = raw === "mainnet" || raw === "public";

export const NETWORK_NAME = IS_MAINNET ? "stellar-mainnet" : "stellar-testnet";
export const NETWORK_LABEL = IS_MAINNET ? "STELLAR_MAINNET" : "STELLAR_TESTNET";
export const NETWORK_PASSPHRASE = IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET;

export const HORIZON_URL = IS_MAINNET
  ? "https://horizon.stellar.org"
  : "https://horizon-testnet.stellar.org";

export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const FRIENDBOT_AVAILABLE = !IS_MAINNET;

const EXPLORER_SEGMENT = IS_MAINNET ? "public" : "testnet";
export const explorerTxUrl = (hash) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/tx/${hash}`;
export const explorerAccountUrl = (publicKey) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/account/${publicKey}`;
export const explorerAssetUrl = (code, issuer) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/asset/${code}-${issuer}`;

/** Shared Horizon.Server instance — reuse across services. */
export const horizon = new Horizon.Server(HORIZON_URL);
