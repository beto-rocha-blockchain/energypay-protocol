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

const issuer = Keypair.fromSecret(
  "SCUTSXBMUATYS7JWMFPRT3IVDTGQASOVLYA3FFZL2JAZNKSJZAWBYSBH"
);

const treasury = Keypair.fromPublicKey(
  "GCBW5QOXN3B2UKDLKVCFW5RCD4QMGF7E5TYFUZWPILN2XC2DZ72T5AOW"
);

const EPWR = new Asset(
  "EPWR",
  issuer.publicKey()
);

async function mintEPWR() {
  const issuerAccount = await server.loadAccount(
    issuer.publicKey()
  );

  const tx = new TransactionBuilder(
    issuerAccount,
    {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }
  )
    .addOperation(
      Operation.payment({
        destination: treasury.publicKey(),
        asset: EPWR,
        amount: "1000000",
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(issuer);

  const result =
    await server.submitTransaction(tx);

  console.log("\nEPWR MINTED\n");
  console.log("HASH:", result.hash);
}

mintEPWR().catch(console.error);