import StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

export async function executeSettlement() {
  const source = StellarSdk.Keypair.fromSecret(
    process.env.STELLAR_SECRET
  );

  const account = await server.loadAccount(
    source.publicKey()
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: "GDMYEG4M7ULWY5MSENBEDTU57BXBKL5NFJYNZMX2JLFJQU5UQZRQEHWJ",
        asset: StellarSdk.Asset.native(),
        amount: "0.1",
      })
    )
    .addMemo(
      StellarSdk.Memo.text(`EP-${Date.now()}`)
    )
    .setTimeout(30)
    .build();

  tx.sign(source);

  try {
    const result = await server.submitTransaction(tx);

    console.log("SUBMIT RESULT:");
    console.log(JSON.stringify(result, null, 2));

    console.log("REAL HASH:", result.hash);

    return {
      txHash: result.hash,
      ledger: result.ledger,
      successful: result.successful,
      fullResult: result,
    };

  } catch (err) {
    console.log("STELLAR ERROR:");
    console.log(err.response?.data || err);
    throw err;
  }
}