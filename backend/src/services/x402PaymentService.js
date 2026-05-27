import { StrKey } from "@stellar/stellar-sdk";
import { horizon as server, NETWORK_NAME, explorerTxUrl } from "../lib/stellar-network.js";

const readString = (value) => (typeof value === "string" ? value.trim() : "");

export function getX402PaymentRequirement() {
  const destination = readString(
    process.env.X402_RECEIVER_PUBLIC_KEY || process.env.STELLAR_DESTINATION,
  );

  const amount = readString(process.env.X402_PRICE_XLM || "0.0001");
  const memo = readString(process.env.X402_MEMO || "X402-PLD");

  if (!StrKey.isValidEd25519PublicKey(destination)) {
    const err = new Error("Invalid X402 receiver public key.");
    err.status = 500;
    err.code = "BAD_X402_RECEIVER";
    throw err;
  }

  return {
    scheme: NETWORK_NAME,
    network: NETWORK_NAME,
    asset: "XLM",
    amount,
    destination,
    memo,
    description: "EnergyPay premium PLD market data API access",
    resource: "/api/x402/pld",
  };
}

function normalizePaymentSignature(headerValue) {
  const raw = readString(headerValue);

  if (!raw) return "";

  // Strip any network prefix (stellar-mainnet: or stellar-testnet:) to get the raw hash
  return raw
    .replace(/^stellar-(mainnet|testnet|public|testnet-public):/i, "")
    .trim();
}

export async function verifyX402Payment(paymentSignature) {
  const txHash = normalizePaymentSignature(paymentSignature);

  if (!txHash || txHash.length < 32) {
    return {
      ok: false,
      status: 402,
      code: "PAYMENT_REQUIRED",
      message: "Missing or invalid PAYMENT-SIGNATURE header.",
    };
  }

  const requirement = getX402PaymentRequirement();

  try {
    const tx = await server.transactions().transaction(txHash).call();

    if (!tx.successful) {
      return {
        ok: false,
        status: 402,
        code: "PAYMENT_NOT_SUCCESSFUL",
        message: "Payment transaction was not successful.",
      };
    }

    if (tx.memo !== requirement.memo) {
      return {
        ok: false,
        status: 402,
        code: "PAYMENT_MEMO_MISMATCH",
        message: `Expected memo ${requirement.memo}.`,
      };
    }

    const operations = await server.operations().forTransaction(txHash).call();

    const payment = operations.records.find((op) => {
      return (
        op.type === "payment" &&
        op.asset_type === "native" &&
        op.to === requirement.destination &&
        Number(op.amount) >= Number(requirement.amount)
      );
    });

    if (!payment) {
      return {
        ok: false,
        status: 402,
        code: "PAYMENT_NOT_FOUND",
        message: "No matching Stellar Testnet payment found for this x402 request.",
      };
    }

    return {
      ok: true,
      txHash,
      ledger: tx.ledger_attr,
      from: payment.from,
      to: payment.to,
      asset: "XLM",
      amount: payment.amount,
      memo: tx.memo,
      explorer_url: explorerTxUrl(txHash),
    };
  } catch (error) {
    return {
      ok: false,
      status: 402,
      code: "PAYMENT_VERIFICATION_FAILED",
      message: error.message || "Unable to verify payment on Stellar network.",
    };
  }
}