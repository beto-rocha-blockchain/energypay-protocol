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
  process.env.STELLAR_SECRET
);

const EPWR = new Asset(
  "EPWR",
  process.env.EPWR_ISSUER_PUBLIC
);

async function setupTrustline() {
  const account = await server.loadAccount(
    operator.publicKey()
  );

  const tx = new TransactionBuilder(
    account,
    {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }
  )
    .addOperation(
      Operation.changeTrust({
        asset: EPWR,
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(operator);

  const result =
    await server.submitTransaction(tx);

  console.log(
    "\nOPERATOR TRUSTLINE CREATED\n"
  );

  console.log(result.hash);
}

setupTrustline().catch(console.error);