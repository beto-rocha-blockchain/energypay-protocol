import express from "express";

import {
  createTrustline,
  mintEPWR,
  getDistributionBalances,
  getIssuerAddress,
  getDistributionAddress,
} from "../services/tokenService.js";

const router = express.Router();

// ========================================
// Create Trustline
// ========================================

router.post("/trustline", async (req, res) => {

  const result = await createTrustline();

  res.json(result);
});

// ========================================
// Mint EPWR
// ========================================

router.post("/mint", async (req, res) => {

  const { amount } = req.body;

  const result = await mintEPWR(
    amount || "1000"
  );

  res.json(result);
});

// ========================================
// Distribution Balances
// ========================================

router.get("/balances", async (req, res) => {

  const result =
    await getDistributionBalances();

  res.json(result);
});

// ========================================
// Wallet Addresses
// ========================================

router.get("/addresses", async (req, res) => {

  res.json({
    issuer: getIssuerAddress(),
    distribution:
      getDistributionAddress(),
  });
});

export default router;