import { Keypair, StrKey, Networks, Horizon } from "@stellar/stellar-sdk";

export type RealStellarKeypair = {
  publicKey: string;
  secretKey: string;
  network: "STELLAR_TESTNET";
  funded: boolean;
  createdAt: string;
};

export const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;

export const horizonServer = () => new Horizon.Server(HORIZON_TESTNET);

/** Generate a real ed25519 Stellar keypair using @stellar/stellar-sdk. */
export const generateKeypair = (): { publicKey: string; secretKey: string } => {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
};

/** Validate a Stellar G... ed25519 public key using StrKey. */
export const isValidPublicKey = (key: string): boolean => {
  try {
    return StrKey.isValidEd25519PublicKey(key.trim());
  } catch {
    return false;
  }
};

/** Validate an S... ed25519 secret seed. */
export const isValidSecretKey = (key: string): boolean => {
  try {
    return StrKey.isValidEd25519SecretSeed(key.trim());
  } catch {
    return false;
  }
};

/**
 * Fund a Stellar Testnet account using Friendbot.
 * Returns true if account is funded (either now or already existed).
 */
export const fundWithFriendbot = async (publicKey: string): Promise<boolean> => {
  if (!isValidPublicKey(publicKey)) return false;
  try {
    const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`);
    if (res.ok) return true;
    // Friendbot returns 400 if account already exists — that's still funded.
    const body = await res.json().catch(() => ({}));
    const detail = (body?.detail ?? "").toString().toLowerCase();
    if (detail.includes("createaccountalreadyexist") || detail.includes("already")) return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * Sign an arbitrary payload with the operator's secret key.
 * Returns the ed25519 signature as a hex string.
 */
export const signPayloadHex = (secretKey: string, message: string): string => {
  const kp = Keypair.fromSecret(secretKey);
  const data = new TextEncoder().encode(message);
  const sig = kp.sign(data as unknown as Buffer);
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const stellarExpertAccount = (publicKey: string) =>
  `https://stellar.expert/explorer/testnet/account/${publicKey}`;

export const stellarExpertTx = (txHash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${txHash}`;

import {
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export type SubmitResult = {
  hash: string;
  ledger: number;
  successful: boolean;
};

/**
 * Submit a real Stellar Testnet payment from the operator's funded account.
 * Auto-creates the destination account if it does not yet exist.
 */
export const submitTestnetPayment = async (params: {
  sourceSecret: string;
  destinationPublicKey: string;
  amount: string; // e.g. "0.5"
  memo?: string;
}): Promise<SubmitResult> => {
  const { sourceSecret, destinationPublicKey, amount, memo } = params;
  if (!isValidPublicKey(destinationPublicKey)) {
    throw new Error("Invalid destination public key.");
  }
  const server = horizonServer();
  const sourceKp = Keypair.fromSecret(sourceSecret);
  const sourceAccount = await server.loadAccount(sourceKp.publicKey());

  let destExists = true;
  try {
    await server.loadAccount(destinationPublicKey);
  } catch {
    destExists = false;
  }

  const op = destExists
    ? Operation.payment({
        destination: destinationPublicKey,
        asset: Asset.native(),
        amount,
      })
    : Operation.createAccount({
        destination: destinationPublicKey,
        startingBalance: amount === "0" ? "1" : amount,
      });

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60);

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  const tx = builder.build();
  tx.sign(sourceKp);
  const res = await server.submitTransaction(tx);
  // hash and ledger fields exist on Horizon submission response
  return {
    hash: (res as unknown as { hash: string }).hash,
    ledger: (res as unknown as { ledger: number }).ledger,
    successful: (res as unknown as { successful?: boolean }).successful ?? true,
  };
};
