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

const issuer = Keypair.fromSecret("SCUTSXBMUATYS7JWMFPRT3IVDTGQASOVLYA3FFZL2JAZNKSJZAWBYSBH");
const treasury = Keypair.fromSecret("SDNNNBW4CIEW55KYQU3EOTWCEZZDRKA6RZUP6D3AFGHIOH6M5MAYRGUK");

const EPWR = new Asset(
  "EPWR",
  issuer.publicKey()
);

async function setupTrustline() {
  const treasuryAccount = await server.loadAccount(
    treasury.publicKey()
  );

  const tx = new TransactionBuilder(
    treasuryAccount,
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

  tx.sign(treasury);

  const result =
    await server.submitTransaction(tx);

  console.log("\nTRUSTLINE CREATED\n");
  console.log(result.hash);
}

setupTrustline().catch(console.error);