import { supabase } from "../lib/supabase.js";
import StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

export async function executeSettlement() {
  const source = StellarSdk.Keypair.fromSecret(
    process.env.STELLAR_SECRET
  );

  const destination =
    process.env.STELLAR_DESTINATION;

  const account = await server.loadAccount(
    source.publicKey()
  );

  const tx = new StellarSdk.TransactionBuilder(
    account,
    {
      fee: "100",
      networkPassphrase:
        StellarSdk.Networks.TESTNET,
    }
  )
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: StellarSdk.Asset.native(),
        amount: "0.1",
      })
    )
    .addMemo(
      StellarSdk.Memo.text(
        `EP-${Date.now()}`
      )
    )
    .setTimeout(30)
    .build();

  tx.sign(source);

  const result =
    await server.submitTransaction(tx);
    await supabase.from("settlements").insert({
      settlement_id: `STL-${Date.now()}`,
      contract_id: "EPC-2047",

      buyer: "Vale Energia",
      seller: "Furnas",

      amount_brl: 47220000,
      pld: 278,

      tx_hash: result.hash,
      ledger: result.ledger,

      status: "SETTLED",
    });

  console.log(
    "REAL HASH:",
    result.hash
  );

  return {
    txHash: result.hash,
    ledger: result.ledger,
    successful: result.successful,
  };
}