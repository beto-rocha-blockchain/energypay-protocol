import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { executeSettlement } from "../services/stellarSettlementService.js";
import { explorerTxUrl } from "../lib/stellar-network.js";

const router = express.Router();
const SETTLEMENT_ROLES = new Set(["SELLER", "GENERATOR"]);

const rolesFor = (operator) =>
  Array.isArray(operator?.roles) ? operator.roles.map((role) => String(role).toUpperCase()) : [];

const canExecuteSettlement = (operator) =>
  rolesFor(operator).some((role) => SETTLEMENT_ROLES.has(role));

router.post("/transfer", requireAuth, async (req, res) => {
  try {
    if (!canExecuteSettlement(req.operator)) {
      return res.status(403).json({
        error: "Operator role is not authorized to execute settlements.",
      });
    }

    const payload = {
      ...(req.body ?? {}),
      sender_user_id: req.operator.sub || req.operator.id,
    };

    delete payload.roles;
    delete payload.access_level;

    const result = await executeSettlement(payload, {
      operator: req.operator,
    });

    return res.json({
      transfer_id: result.transferId,
      source_public_key: result.sourcePublicKey,
      destination_public_key: result.destinationPublicKey,
      asset: result.asset,
      amount: result.amount,
      tx_hash: result.txHash,
      ledger: result.ledger,
      finality_ms: result.finalityMs,
      status: "FINALIZED",
      explorer_link: explorerTxUrl(result.txHash),
      timestamp: new Date().toISOString(),
      memo: result.memo,
    });
  } catch (err) {
    console.error("P2P ERROR =>", err.message);

    return res.status(err.status || 500).json({
      error: err.message,
      code: err.code || "P2P_TRANSFER_FAILED",
    });
  }
});

export default router;
