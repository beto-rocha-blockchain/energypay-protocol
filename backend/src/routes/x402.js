import express from "express";
import {
  getX402PaymentRequirement,
  verifyX402Payment,
} from "../services/x402PaymentService.js";
import { NETWORK_NAME, HORIZON_URL } from "../lib/stellar-network.js";

const ONS_ORACLE_URL = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm";

/** Fetch the latest SE/CO PLD from ONS (same source as /api/oracle/pld). */
async function fetchLatestPld() {
  const year = new Date().getFullYear();
  const url = `${ONS_ORACLE_URL}/CMO_SEMIHORARIO_${year}.csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`ONS HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  let latestTs = "";
  let latestSE = null;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 4) continue;
    const ts = parts[2].trim();
    const sub = parts[0].trim();
    const cmo = parseFloat(parts[3].trim());
    if (ts > latestTs) latestTs = ts;
    if (sub === "SE" && ts === latestTs) latestSE = cmo;
  }
  // second pass to catch SE row after latestTs was determined
  if (latestSE === null) {
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(";");
      if (parts.length < 4) continue;
      if (parts[2].trim() === latestTs && parts[0].trim() === "SE") {
        latestSE = parseFloat(parts[3].trim());
        break;
      }
    }
  }
  return { pld_brl_mwh: latestSE, timestamp: latestTs, source: "ONS — CMO Semi-horário" };
}

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
      retry_with_header: "PAYMENT-SIGNATURE: stellar-mainnet:<txHash>",
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

  let pldData;
  try {
    pldData = await fetchLatestPld();
  } catch (err) {
    return res.status(502).json({
      error: "Oracle Unavailable",
      code: "ORACLE_FETCH_FAILED",
      message: "Could not retrieve live PLD from ONS. Please retry.",
      detail: err.message,
    });
  }

  return res.json({
    status: "ACCESS_GRANTED",
    protocol: "x402-compatible",
    network: NETWORK_NAME,
    resource: "premium-pld-feed",
    payment: verification,
    data: {
      market: "Brazil Free Energy Market",
      subsystem: "SE/CO",
      pld_brl_mwh: pldData.pld_brl_mwh,
      updated_at: pldData.timestamp,
      source: pldData.source,
      settlement_window: "D+0",
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/status", (req, res) => {
  res.json({
    status: "online",
    protocol: "x402-compatible",
    network: NETWORK_NAME,
    resource: "/api/x402/pld",
    payment_required: getX402PaymentRequirement(),
  });
});

export default router;