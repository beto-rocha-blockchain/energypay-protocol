import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { supabase } from "../lib/supabase.js";

import { horizon as server, NETWORK_PASSPHRASE, explorerTxUrl } from "../lib/stellar-network.js";
const SUPPORTED_ASSETS = new Set(["XLM", "EPWR"]);

class SettlementInputError extends Error {
  constructor(message, status = 400, code = "INVALID_SETTLEMENT_PAYLOAD") {
    super(message);
    this.name = "SettlementInputError";
    this.status = status;
    this.code = code;
  }
}

const readString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeAssetCode = (asset) => {
  const code = readString(asset || "XLM").toUpperCase();
  if (!SUPPORTED_ASSETS.has(code)) {
    throw new SettlementInputError("Unsupported asset. Allowed: XLM, EPWR, EPRW.", 422);
  }
  return code;
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new SettlementInputError("Amount must be a positive number.", 422);
  }

  return amount.toFixed(7).replace(/\.?0+$/, "");
};

const resolveDestination = (payload) => {
  const destination =
    readString(payload.recipient_public_key) ||
    readString(payload.destination_public_key) ||
    readString(payload.destination) ||
    readString(process.env.STELLAR_DESTINATION);

  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new SettlementInputError("Invalid Stellar destination public key.", 422);
  }

  return destination;
};

const resolveMemo = (payload) => {
  const raw =
    readString(payload.memo) ||
    readString(payload.transfer_id) ||
    readString(payload.settlement_id) ||
    `EP-${Date.now()}`;

  const ascii = raw.replace(/[^\x20-\x7E]/g, "");
  return Buffer.byteLength(ascii, "utf8") <= 28
    ? ascii
    : Buffer.from(ascii, "utf8").subarray(0, 28).toString("utf8");
};

const keypairFromEnv = (name) => {
  const secret = process.env[name];
  if (!secret) {
    throw new SettlementInputError(`Missing ${name} environment variable.`, 500, "MISSING_ENV");
  }

  try {
    return Keypair.fromSecret(secret);
  } catch {
    throw new SettlementInputError(`${name} is not a valid Stellar secret seed.`, 500, "BAD_ENV");
  }
};

const resolveIssuerPublicKey = () => {
  const explicit = readString(process.env.EPWR_ISSUER_PUBLIC_KEY);

  if (explicit) {
    if (!StrKey.isValidEd25519PublicKey(explicit)) {
      throw new SettlementInputError(
        "Configured EPWR issuer public key is invalid.",
        500,
        "BAD_ENV",
      );
    }
    return explicit;
  }

  return keypairFromEnv("ISSUER_SECRET").publicKey();
};

const resolvePaymentContext = (assetCode, userKeypair) => {
  const asset = assetCode === "XLM"
    ? Asset.native()
    : new Asset(assetCode, resolveIssuerPublicKey());

  // If we have a user keypair, send from the user's own account
  if (userKeypair) {
    return { source: userKeypair, asset };
  }

  // Fallback: platform custody accounts
  if (assetCode === "XLM") {
    return { source: keypairFromEnv("STELLAR_SECRET"), asset };
  }

  const source = process.env.DISTRIBUTION_SECRET
    ? keypairFromEnv("DISTRIBUTION_SECRET")
    : keypairFromEnv("STELLAR_SECRET");

  return { source, asset };
};

/**
 * Resolve the sender's Keypair from the authenticated user's Supabase record.
 * Returns null if the user has no stored secret (caller falls back to custody).
 */
const resolveUserKeypair = async (userId) => {
  if (!userId) return null;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("stellar_secret_encrypted")
      .eq("id", userId)
      .single();

    if (error || !user?.stellar_secret_encrypted) return null;

    return Keypair.fromSecret(user.stellar_secret_encrypted);
  } catch {
    return null;
  }
};

const buildSettlementRecord = (payload, result, operator) => ({
  settlement_id:
    readString(payload.transfer_id) || readString(payload.settlement_id) || `STL-${Date.now()}`,
  contract_id: readString(payload.contract_id) || readString(payload.contractId) || "P2P",
  buyer: readString(payload.sender_user_id) || readString(operator?.sub) || "EnergyPay Custody",
  seller: result.destinationPublicKey,
  amount_brl: Number(payload.amount_brl ?? payload.amount ?? 0),
  pld: Number(payload.pld ?? 0),
  tx_hash: result.txHash,
  ledger: result.ledger,
  status: "SETTLED",
});

async function persistSettlement(payload, result, operator) {
  try {
    const { error } = await supabase
      .from("settlements")
      .insert(buildSettlementRecord(payload, result, operator));
    if (error) {
      console.warn("Settlement audit insert failed:", error.message);
    }
  } catch (error) {
    console.warn("Settlement audit insert skipped:", error.message);
  }
}

const horizonErrorMessage = (error) => {
  const resultCodes = error?.response?.data?.extras?.result_codes;
  if (resultCodes) return `Horizon rejected transaction: ${JSON.stringify(resultCodes)}`;
  return error?.response?.data?.title || error.message || "Stellar settlement failed.";
};

export async function executeSettlement(payload = {}, context = {}) {
  const assetCode = normalizeAssetCode(payload.asset);
  const amount = normalizeAmount(payload.amount ?? payload.amount_xlm ?? "0.1");
  const destination = resolveDestination(payload);
  const memo = resolveMemo(payload);

  // Try to send from the authenticated user's own account
  const senderId = readString(payload.sender_user_id) || context.operator?.sub || context.operator?.id;
  const userKeypair = await resolveUserKeypair(senderId);
  const { source, asset } = resolvePaymentContext(assetCode, userKeypair);

  const startedAt = Date.now();

  try {
    const account = await server.loadAccount(source.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset,
          amount,
        }),
      )
      .addMemo(Memo.text(memo))
      .setTimeout(30)
      .build();

    tx.sign(source);

    const submission = await server.submitTransaction(tx);
    const result = {
      transferId:
        readString(payload.transfer_id) || readString(payload.settlement_id) || `STL-${Date.now()}`,
      txHash: submission.hash,
      ledger: submission.ledger,
      successful: submission.successful,
      sourcePublicKey: source.publicKey(),
      destinationPublicKey: destination,
      asset: assetCode,
      amount: Number(amount),
      memo,
      finalityMs: Date.now() - startedAt,
    };

    await persistSettlement(payload, result, context.operator);

    console.log("REAL HASH:", result.txHash);
    return result;
  } catch (error) {
    if (error instanceof SettlementInputError) throw error;

    const wrapped = new Error(horizonErrorMessage(error));
    wrapped.status = error?.response?.status || 502;
    wrapped.code = "STELLAR_SUBMISSION_FAILED";
    throw wrapped;
  }
}
