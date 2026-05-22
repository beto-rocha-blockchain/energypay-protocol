import express from "express";

import {
  createTrustline,
  createTrustlineForAccount,
  getDistributionAddress,
  getDistributionBalances,
  getEPWRAssetInfo,
  getIssuerAddress,
  mintEPWR,
  sendEPWR,
} from "../services/tokenService.js";

const router = express.Router();

router.get("/asset", (req, res) => {
  try {
    res.json({
      success: true,
      asset: getEPWRAssetInfo(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || "TOKEN_ASSET_ERROR",
    });
  }
});

router.get("/addresses", (req, res) => {
  try {
    res.json({
      success: true,
      issuer: getIssuerAddress(),
      distribution: getDistributionAddress(),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || "TOKEN_ADDRESS_ERROR",
    });
  }
});

// Creates EPWR trustline for the distribution account.
router.post("/trustline", async (req, res) => {
  const result = await createTrustline();
  res.status(result.success ? 200 : 400).json(result);
});

// Testnet-only utility.
// Creates EPWR trustline for an arbitrary testnet account.
// Requires the account secret because trustline must be signed by that account.
router.post("/trustline/account", async (req, res) => {
  const { secret } = req.body ?? {};

  const result = await createTrustlineForAccount(secret);
  res.status(result.success ? 200 : 400).json(result);
});

// Mints EPWR from issuer to distribution.
router.post("/mint", async (req, res) => {
  const { amount } = req.body ?? {};

  const result = await mintEPWR(amount || "1000");
  res.status(result.success ? 200 : 400).json(result);
});

// Sends EPWR from distribution to a destination account.
router.post("/send", async (req, res) => {
  const { destination, amount } = req.body ?? {};

  const result = await sendEPWR(destination, amount || "10");
  res.status(result.success ? 200 : 400).json(result);
});

router.get("/balances", async (req, res) => {
  const result = await getDistributionBalances();
  res.status(result.success ? 200 : 400).json(result);
});

export default router;
