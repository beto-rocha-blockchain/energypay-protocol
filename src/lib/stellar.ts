/**
 * Stellar helper utilities — frontend-only, NO secret key handling.
 *
 * The frontend never generates, holds, transports or signs with secret keys.
 * Wallet provisioning, ed25519 signing, Friendbot funding and Horizon
 * submission are all performed exclusively by the backend in-memory.
 *
 * This module only exposes:
 *   - format validation for G... public keys
 *   - Stellar Expert explorer URL builders
 */

import { StrKey } from "@stellar/stellar-sdk";

export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const STELLAR_NETWORK = "STELLAR_TESTNET" as const;

/** Validate a Stellar G... ed25519 public key using StrKey checksum. */
export const isValidPublicKey = (key: string): boolean => {
  try {
    return StrKey.isValidEd25519PublicKey(key.trim());
  } catch {
    return false;
  }
};

export const stellarExpertAccount = (publicKey: string) =>
  `https://stellar.expert/explorer/testnet/account/${publicKey}`;

export const stellarExpertTx = (txHash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${txHash}`;
