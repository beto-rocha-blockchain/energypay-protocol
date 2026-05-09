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
  const sig = kp.sign(Buffer.from(message, "utf-8"));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const stellarExpertAccount = (publicKey: string) =>
  `https://stellar.expert/explorer/testnet/account/${publicKey}`;

export const stellarExpertTx = (txHash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${txHash}`;
