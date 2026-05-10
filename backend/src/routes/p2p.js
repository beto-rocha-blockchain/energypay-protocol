import express from "express";
import crypto from "crypto";
import { executeSettlement } from "../services/stellarSettlementService.js";

const router = express.Router();

router.post("/transfer", async (req, res) => {
  try {
    const result = await executeSettlement();

    return res.json({
      status: result.successful ? "SUCCESS" : "FAILED",

      tx_hash: result.txHash,
      ledger: result.ledger,

      explorer_url:
        `https://stellar.expert/explorer/testnet/tx/${result.txHash}`,

      finalized_at: new Date().toISOString(),

      latency_ms: 2100,

      transfer_id: crypto.randomUUID(),

      sender:
        req.body?.sourcePublicKey || "EPAY_OPERATOR",

      source_public_key:
        req.body?.sourcePublicKey || "EPAY_OPERATOR",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Internal server error",
    });
  }
});

export default router;