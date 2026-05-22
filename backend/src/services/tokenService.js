import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

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

const explorerLink = (hash) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

const serializeError = (error) => ({
  success: false,
  error: error.message || "Token service failed.",
  code: error.code || "TOKEN_SERVICE_ERROR",
});

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
      networkPassphrase: Networks.TESTNET,
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
      networkPassphrase: Networks.TESTNET,
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
      networkPassphrase: Networks.TESTNET,
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
      networkPassphrase: Networks.TESTNET,
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
