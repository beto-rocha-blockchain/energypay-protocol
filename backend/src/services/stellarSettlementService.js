import "dotenv/config";

import { supabase } from "../lib/supabase.js";
import StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

const EPWR = new StellarSdk.Asset(
  "EPWR",
  process.env.EPWR_ISSUER_PUBLIC
);

export async function executeSettlement() {
  try {
    const source = StellarSdk.Keypair.fromSecret(
      process.env.OPERATOR_SECRET
    );

    const destination =
      process.env.STELLAR_DESTINATION;

    const account =
      await server.loadAccount(
        source.publicKey()
      );

    const tx =
      new StellarSdk.TransactionBuilder(
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
            asset: EPWR,
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

    await supabase
      .from("settlements")
      .insert({
        settlement_id:
          `STL-${Date.now()}`,

        contract_id: "EPC-2047",

        buyer: "Vale Energia",

        seller: "Furnas",

        amount_brl: 47220000,

        pld: 278,

        tx_hash: result.hash,

        ledger: result.ledger,

        asset: "EPWR",

        status: "SETTLED",
      });

    console.log(
      "REAL HASH:",
      result.hash
    );

    console.log(
      "LEDGER:",
      result.ledger
    );

    return {
      txHash: result.hash,

      ledger: result.ledger,

      successful:
        result.successful,

      explorerUrl:
        `https://stellar.expert/explorer/testnet/tx/${result.hash}`,

      asset: "EPWR",
    };

  } catch (error) {

    console.error(
      "SETTLEMENT ERROR:",
      error.response?.data || error.message
    );

    return {
      successful: false,

      error:
        error.response?.data || error.message,
    };
  }
}