import "dotenv/config";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const server = new Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

const operator = Keypair.fromSecret(
  process.env.OPERATOR_SECRET
);

const issuerPublic =
  process.env.EPWR_ISSUER_PUBLIC;

export const EPWR = new Asset(
  "EPWR",
  issuerPublic
);

export async function executeEPWRSettlement({
  destination,
  amount,
  memo,
}) {
  const sourceAccount =
    await server.loadAccount(
      operator.publicKey()
    );

  const tx = new TransactionBuilder(
    sourceAccount,
    {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }
  )
    .addOperation(
      Operation.payment({
        destination,
        asset: EPWR,
        amount: String(amount),
      })
    )
    .addMemo({
      type: "text",
      value: memo?.slice(0, 28) || "EPWR settlement",
    })
    .setTimeout(30)
    .build();

  tx.sign(operator);

  const result =
    await server.submitTransaction(tx);

  return {
    hash: result.hash,
    ledger: result.ledger,
    explorer:
      `https://stellar.expert/explorer/testnet/tx/${result.hash}`,
  };
}