import express from "express";
import jwt from "jsonwebtoken";

import {
  buyEPWRWithXLMForUser,
  createTrustline,
  createTrustlineForAccount,
  createTrustlineForSecret,
  getDistributionAddress,
  getDistributionBalances,
  getEPWRAssetInfo,
  getIssuerAddress,
  mintEPWR,
  sendEPWR,
} from "../services/tokenService.js";

const router = express.Router();

const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Missing authorization token.",
        code: "MISSING_AUTH_TOKEN",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.operator = payload;

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authorization token.",
      code: "INVALID_AUTH_TOKEN",
    });
  }
};

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

router.post("/buy/me", requireAuth, async (req, res) => {
  try {
    const userId = req.operator?.sub || req.operator?.id;
    const { amount } = req.body ?? {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Missing authenticated user id.",
        code: "MISSING_USER",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, stellar_public_key, stellar_secret_encrypted")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: "Authenticated user wallet not found.",
        code: "USER_WALLET_NOT_FOUND",
      });
    }

    if (!user.stellar_secret_encrypted) {
      return res.status(422).json({
        success: false,
        error: "Authenticated user wallet secret is not available.",
        code: "USER_WALLET_SECRET_MISSING",
      });
    }

    const result = await buyEPWRWithXLMForUser(
      user.stellar_secret_encrypted,
      amount || "10",
    );

    return res.status(result.success ? 200 : 400).json({
      ...result,
      user_id: user.id,
      expected_public_key: user.stellar_public_key,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || "EPWR_PURCHASE_FAILED",
    });
  }
});

router.get("/balances", async (req, res) => {
  const result = await getDistributionBalances();
  res.status(result.success ? 200 : 400).json(result);
});

export default router;

