/**
 * Stellar helper utilities — frontend-only, NO secret key handling.
 *
 * The frontend never generates, holds, transports or signs with secret keys.
 * Wallet provisioning, ed25519 signing, Friendbot funding and Horizon
 * submission are all performed exclusively by the backend in-memory.
 *
 * Network detection: reads VITE_STELLAR_NETWORK at build time.
 *   "mainnet" → Stellar public network
 *   anything else (or unset) → Stellar testnet (default)
 */

import { StrKey } from "@stellar/stellar-sdk";

const raw = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet").toString().toLowerCase().trim();
export const IS_MAINNET = raw === "mainnet" || raw === "public";

export const HORIZON_URL = IS_MAINNET
  ? "https://horizon.stellar.org"
  : "https://horizon-testnet.stellar.org";

export const STELLAR_NETWORK = IS_MAINNET ? "STELLAR_MAINNET" : "STELLAR_TESTNET";
export const STELLAR_NETWORK_LABEL = IS_MAINNET ? "Stellar Mainnet" : "Stellar Testnet";

const EXPLORER_SEGMENT = IS_MAINNET ? "public" : "testnet";

/** Validate a Stellar G... ed25519 public key using StrKey checksum. */
export const isValidPublicKey = (key: string): boolean => {
  try {
    return StrKey.isValidEd25519PublicKey(key.trim());
  } catch {
    return false;
  }
};

export const stellarExpertAccount = (publicKey: string) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/account/${publicKey}`;

export const stellarExpertTx = (txHash: string) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/tx/${txHash}`;

export const stellarExpertAsset = (code: string, issuer: string) =>
  `https://stellar.expert/explorer/${EXPLORER_SEGMENT}/asset/${code}-${issuer}`;
