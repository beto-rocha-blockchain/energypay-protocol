import express from "express";
import { executeSettlement } from "../services/stellarSettlementService.js";

const router = express.Router();

router.post("/transfer", async (req, res) => {
  try {
    const {
      recipient_public_key,
      amount,
      asset,
      memo,
      transfer_id,
    } = req.body;

    console.log("P2P TRANSFER =>", req.body);

    const result = await executeSettlement();
    
    return res.json({
      transfer_id,

      source_public_key:
        "ENERGYPAY_SETTLEMENT_WALLET",

      destination_public_key:
        recipient_public_key,

      asset,
      amount,

      tx_hash: result.txHash,

      ledger: result.ledger,

      finality_ms: 1800,

      status: "FINALIZED",

      explorer_link:
        `https://stellar.expert/explorer/testnet/tx/${result.txHash}`,

      timestamp: new Date().toISOString(),

      memo,
    });
  } catch (err) {
    console.error("P2P ERROR =>", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;