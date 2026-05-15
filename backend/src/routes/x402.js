import express from "express";
import {
  getX402PaymentRequirement,
  verifyX402Payment,
} from "../services/x402PaymentService.js";

const router = express.Router();

function paymentRequired(res) {
  const requirement = getX402PaymentRequirement();

  return res
    .status(402)
    .set("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(requirement)).toString("base64"))
    .json({
      error: "Payment Required",
      code: "X402_PAYMENT_REQUIRED",
      message: "This EnergyPay resource requires an x402-compatible payment.",
      payment_required: requirement,
      retry_with_header: "PAYMENT-SIGNATURE: stellar-testnet:<txHash>",
    });
}

router.get("/pld", async (req, res) => {
  const paymentSignature = req.headers["payment-signature"];

  if (!paymentSignature) {
    return paymentRequired(res);
  }

  const verification = await verifyX402Payment(paymentSignature);

  if (!verification.ok) {
    return res.status(verification.status || 402).json({
      error: "Payment Required",
      code: verification.code,
      message: verification.message,
      payment_required: getX402PaymentRequirement(),
    });
  }

  return res.json({
    status: "ACCESS_GRANTED",
    protocol: "x402-compatible",
    network: "stellar-testnet",
    resource: "premium-pld-feed",
    payment: verification,
    data: {
      market: "Brazil Free Energy Market",
      subsystem: "SE/CO",
      pld_brl_mwh: 173.42,
      settlement_window: "D+0 simulated",
      source: "EnergyPay Oracle Simulation",
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/status", (req, res) => {
  res.json({
    status: "online",
    protocol: "x402-compatible",
    network: "stellar-testnet",
    resource: "/api/x402/pld",
    payment_required: getX402PaymentRequirement(),
  });
});

export default router;