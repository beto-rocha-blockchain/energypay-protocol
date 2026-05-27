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

import { horizon as server, NETWORK_PASSPHRASE, explorerTxUrl } from "../lib/stellar-network.js";

const EPWR_CODE = "EPWR";

class TokenServiceError extends Error {
  constructor(message, status = 400, code = "TOKEN_SERVICE_ERROR") {
    super(message);
    this.name = "TokenServiceError";
    this.status = status;
    this.code = code;
  }
}

const readString = (value) => (typeof value === "string" ? value.trim() : "");

const keypairFromEnv = (name) => {
  const secret = readString(process.env[name]);

  if (!secret) {
    throw new TokenServiceError(
      `Missing ${name} environment variable.`,
      500,
      "MISSING_ENV",
    );
  }

  try {
    return Keypair.fromSecret(secret);
  } catch {
    throw new TokenServiceError(
      `${name} is not a valid Stellar secret seed.`,
      500,
      "BAD_ENV",
    );
  }
};

const keypairFromSecret = (secret, label = "account secret") => {
  const cleanSecret = readString(secret);

  if (!cleanSecret) {
    throw new TokenServiceError(`Missing ${label}.`, 422, "MISSING_SECRET");
  }

  try {
    return Keypair.fromSecret(cleanSecret);
  } catch {
    throw new TokenServiceError(
      `${label} is not a valid Stellar secret seed.`,
      422,
      "BAD_SECRET",
    );
  }
};

const getIssuerKeypair = () => keypairFromEnv("ISSUER_SECRET");

const getDistributionKeypair = () => keypairFromEnv("DISTRIBUTION_SECRET");

const getIssuerPublicKey = () => {
  const explicitIssuer = readString(process.env.EPWR_ISSUER_PUBLIC_KEY);

  if (explicitIssuer) {
    if (!StrKey.isValidEd25519PublicKey(explicitIssuer)) {
      throw new TokenServiceError(
        "EPWR_ISSUER_PUBLIC_KEY is not a valid Stellar public key.",
        500,
        "BAD_ENV",
      );
    }

    return explicitIssuer;
  }

  return getIssuerKeypair().publicKey();
};

const getEPWRAsset = () => new Asset(EPWR_CODE, getIssuerPublicKey());

const normalizeAmount = (value, fallback = "1000") => {
  const amount = Number(value ?? fallback);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TokenServiceError(
      "Amount must be a positive number.",
      422,
      "INVALID_AMOUNT",
    );
  }

  return amount.toFixed(7).replace(/\.?0+$/, "");
};

const explorerLink = (hash) => explorerTxUrl(hash);

const serializeError = (error) => {
  // Extract Stellar/Horizon result codes when the SDK throws an Axios-style error
  // (older stellar-sdk wraps Horizon HTTP 400 as Axios "Request failed with status code 400")
  const resultCodes =
    error?.response?.data?.extras?.result_codes ??
    error?.extras?.result_codes ??
    null;

  let errorMessage = error.message || "Token service failed.";
  if (resultCodes) {
    const txCode = resultCodes.transaction || "";
    const opCodes = Array.isArray(resultCodes.operations)
      ? resultCodes.operations.join(", ")
      : "";
    errorMessage = `Stellar transaction rejected: ${txCode}${opCodes ? ` [ops: ${opCodes}]` : ""}`;
  }

  return {
    success: false,
    error: errorMessage,
    code: error.code || "TOKEN_SERVICE_ERROR",
    ...(resultCodes ? { result_codes: resultCodes } : {}),
  };
};

export function getIssuerAddress() {
  return getIssuerPublicKey();
}

export function getDistributionAddress() {
  return getDistributionKeypair().publicKey();
}

export function getEPWRAssetInfo() {
  const issuer = getIssuerPublicKey();

  return {
    code: EPWR_CODE,
    issuer,
    asset_id: `${EPWR_CODE}:${issuer}`,
  };
}

// Distribution accepts EPWR from issuer.
export async function createTrustline() {
  try {
    const distributionKeypair = getDistributionKeypair();
    const account = await server.loadAccount(distributionKeypair.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.changeTrust({
          asset: getEPWRAsset(),
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "trustline-created",
      account: distributionKeypair.publicKey(),
      asset: getEPWRAssetInfo(),
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR trustline error:", error);
    return serializeError(error);
  }
}

// Testnet-only utility.
// Creates EPWR trustline for any test account when its secret is provided.
// Do not use this pattern in production.
export async function createTrustlineForSecret(
  accountSecret,
  type = "account-trustline-created",
) {
  try {
    const accountKeypair = keypairFromSecret(accountSecret, "account secret");
    const account = await server.loadAccount(accountKeypair.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.changeTrust({
          asset: getEPWRAsset(),
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(accountKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type,
      account: accountKeypair.publicKey(),
      asset: getEPWRAssetInfo(),
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR trustline by secret error:", error);
    return serializeError(error);
  }
}

export async function createTrustlineForAccount(accountSecret) {
  return createTrustlineForSecret(accountSecret, "account-trustline-created");
}
// Issuer mints EPWR to Distribution.
export async function mintEPWR(amount = "1000") {
  try {
    const issuerKeypair = getIssuerKeypair();
    const distributionKeypair = getDistributionKeypair();
    const normalizedAmount = normalizeAmount(amount);

    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    const transaction = new TransactionBuilder(issuerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: distributionKeypair.publicKey(),
          asset: getEPWRAsset(),
          amount: normalizedAmount,
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(issuerKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-minted",
      asset: getEPWRAssetInfo(),
      amount: normalizedAmount,
      destination: distributionKeypair.publicKey(),
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR mint error:", error);
    return serializeError(error);
  }
}

// Distribution sends EPWR to a destination account.
// Destination must already have an EPWR trustline.
export async function sendEPWR(destination, amount = "10") {
  try {
    const distributionKeypair = getDistributionKeypair();
    const normalizedAmount = normalizeAmount(amount, "10");

    if (!StrKey.isValidEd25519PublicKey(readString(destination))) {
      throw new TokenServiceError(
        "Invalid Stellar destination public key.",
        422,
        "INVALID_DESTINATION",
      );
    }

    const distributionAccount = await server.loadAccount(
      distributionKeypair.publicKey(),
    );

    const transaction = new TransactionBuilder(distributionAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: getEPWRAsset(),
          amount: normalizedAmount,
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-transfer",
      asset: getEPWRAssetInfo(),
      amount: normalizedAmount,
      source: distributionKeypair.publicKey(),
      destination,
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR transfer error:", error);
    return serializeError(error);
  }
}

export async function buyEPWRWithXLMForUser(userSecret, epwrAmount = "10") {
  try {
    const buyerKeypair = keypairFromSecret(userSecret, "buyer account secret");
    const distributionKeypair = getDistributionKeypair();

    const normalizedEPWRAmount = normalizeAmount(epwrAmount, "10");

    // MVP pricing: 1 EPWR = 1 XLM.
    // Can be changed through EPWR_PRICE_XLM.
    const priceXLM = Number(readString(process.env.EPWR_PRICE_XLM) || "1");

    if (!Number.isFinite(priceXLM) || priceXLM <= 0) {
      throw new TokenServiceError(
        "EPWR_PRICE_XLM must be a positive number.",
        500,
        "INVALID_EPWR_PRICE",
      );
    }

    const xlmToPay = normalizeAmount(
      Number(normalizedEPWRAmount) * priceXLM,
      "10",
    );

    const buyerPublicKey = buyerKeypair.publicKey();
    const distributionPublicKey = distributionKeypair.publicKey();

    const buyerAccount = await server.loadAccount(buyerPublicKey);

    const transaction = new TransactionBuilder(buyerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          source: buyerPublicKey,
          destination: distributionPublicKey,
          asset: Asset.native(),
          amount: xlmToPay,
        }),
      )
      .addOperation(
        Operation.payment({
          source: distributionPublicKey,
          destination: buyerPublicKey,
          asset: getEPWRAsset(),
          amount: normalizedEPWRAmount,
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(buyerKeypair);
    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-purchase",
      buyer: buyerPublicKey,
      seller: distributionPublicKey,
      asset: getEPWRAssetInfo(),
      epwr_amount: normalizedEPWRAmount,
      xlm_paid: xlmToPay,
      price_xlm_per_epwr: priceXLM.toString(),
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR purchase error:", error);
    return serializeError(error);
  }
}

export async function sellEPWRForXLMForUser(userSecret, epwrAmount = "10") {
  try {
    const sellerKeypair = keypairFromSecret(userSecret, "seller account secret");
    const distributionKeypair = getDistributionKeypair();

    const normalizedEPWRAmount = normalizeAmount(epwrAmount, "10");

    // Same price as buy: 1 EPWR = 1 XLM (configurable via EPWR_PRICE_XLM)
    const priceXLM = Number(readString(process.env.EPWR_PRICE_XLM) || "1");

    if (!Number.isFinite(priceXLM) || priceXLM <= 0) {
      throw new TokenServiceError(
        "EPWR_PRICE_XLM must be a positive number.",
        500,
        "INVALID_EPWR_PRICE",
      );
    }

    const xlmToReceive = normalizeAmount(
      Number(normalizedEPWRAmount) * priceXLM,
      "10",
    );

    const sellerPublicKey = sellerKeypair.publicKey();
    const distributionPublicKey = distributionKeypair.publicKey();

    // Verify distribution has enough XLM to pay the user
    const distAccount = await server.loadAccount(distributionPublicKey);
    const distXLM = Number(
      distAccount.balances.find((b) => b.asset_type === "native")?.balance ?? 0,
    );
    // Keep minimum reserve: 1 XLM + 0.5 per subentry
    const reserve = 1 + distAccount.subentry_count * 0.5;
    const available = distXLM - reserve;
    if (available < Number(xlmToReceive)) {
      return {
        success: false,
        error: `Distribution wallet has insufficient XLM for this redemption (available: ${available.toFixed(4)} XLM).`,
        code: "DISTRIBUTION_INSUFFICIENT_XLM",
      };
    }

    const sellerAccount = await server.loadAccount(sellerPublicKey);

    const transaction = new TransactionBuilder(sellerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        // User sends EPWR → Distribution (return tokens)
        Operation.payment({
          source: sellerPublicKey,
          destination: distributionPublicKey,
          asset: getEPWRAsset(),
          amount: normalizedEPWRAmount,
        }),
      )
      .addOperation(
        // Distribution sends XLM → User (redeem value)
        Operation.payment({
          source: distributionPublicKey,
          destination: sellerPublicKey,
          asset: Asset.native(),
          amount: xlmToReceive,
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(sellerKeypair);
    transaction.sign(distributionKeypair);

    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      type: "epwr-redemption",
      seller: sellerPublicKey,
      buyer: distributionPublicKey,
      asset: getEPWRAssetInfo(),
      epwr_sold: normalizedEPWRAmount,
      xlm_received: xlmToReceive,
      price_xlm_per_epwr: priceXLM.toString(),
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("EPWR sell error:", error);
    return serializeError(error);
  }
}

export async function atomicTokenizeContract({
  buyerPublicKey,
  sellerPublicKey,
  volumeMWh,
  priceBRL,
  contractNumber,
  startDate,
  endDate,
  settlementDate,
  memo,
}) {
  try {
    const issuerKeypair = getIssuerKeypair();
    const distributionKeypair = getDistributionKeypair();
    const epwrAsset = getEPWRAsset();

    const tokenAmount = normalizeAmount(volumeMWh, "1");

    const distributionAccount = await server.loadAccount(distributionKeypair.publicKey());

    const txBuilder = new TransactionBuilder(distributionAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
      memo: memo
        ? Memo.text(memo.slice(0, 28))
        : Memo.text(`EP:${(contractNumber || "ATOM").slice(0, 24)}`),
    });

    // Op 1 — Token issuance: issuer mints EPWR to distribution (represents contract energy)
    txBuilder.addOperation(
      Operation.payment({
        source: issuerKeypair.publicKey(),
        destination: distributionKeypair.publicKey(),
        asset: epwrAsset,
        amount: tokenAmount,
      }),
    );

    // Op 2 — Settlement lock: distribution sends EPWR to buyer (tokenized energy delivery)
    txBuilder.addOperation(
      Operation.payment({
        source: distributionKeypair.publicKey(),
        destination: buyerPublicKey,
        asset: epwrAsset,
        amount: tokenAmount,
      }),
    );

    // Op 3 (removed) — manageData was used to anchor contract metadata on-chain, but each
    // entry permanently consumes 0.5 XLM in Stellar base reserve on the distribution account.
    // After N contracts this causes op_low_reserve failures. The tx hash + DB record serve
    // as the durable anchor; the memo already carries the contract reference.

    const tx = txBuilder.setTimeout(30).build();

    tx.sign(issuerKeypair);
    tx.sign(distributionKeypair);

    const result = await server.submitTransaction(tx);

    return {
      success: true,
      type: "atomic-contract-tokenization",
      contract_number: contractNumber || null,
      operations: [
        { op: "token_issuance", detail: `Minted ${tokenAmount} EPWR (issuer → distribution)` },
        { op: "settlement_lock", detail: `Transferred ${tokenAmount} EPWR to buyer` },
      ],
      token_amount: tokenAmount,
      asset: getEPWRAssetInfo(),
      buyer: buyerPublicKey,
      seller: sellerPublicKey,
      hash: result.hash,
      ledger: result.ledger,
      explorer_url: explorerLink(result.hash),
    };
  } catch (error) {
    console.error("Atomic tokenization error:", error);
    return serializeError(error);
  }
}

export async function getDistributionBalances() {
  try {
    const distributionKeypair = getDistributionKeypair();
    const account = await server.loadAccount(distributionKeypair.publicKey());

    return {
      success: true,
      account: distributionKeypair.publicKey(),
      asset: getEPWRAssetInfo(),
      balances: account.balances,
    };
  } catch (error) {
    console.error("EPWR balance error:", error);
    return serializeError(error);
  }
}

