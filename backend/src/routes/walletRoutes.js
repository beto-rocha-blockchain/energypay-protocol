import express from "express";

import {
  createWallet,
  fundAccount,
  getBalance,
  createTrustline,
  issueToken,
  createSellOffer,
  createBuyOffer,
  buyEPRW,
  getOrderbook,
} from "../services/stellarService.js";

const router = express.Router();

// =====================================================
// CREATE WALLET
// =====================================================

router.post("/create", async (req, res) => {
  try {
    const wallet = createWallet();

    await fundAccount(wallet.publicKey);

    res.json({
      success: true,

      wallet: {
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey,

        network: "STELLAR_TESTNET",
        funded: true,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao criar wallet",
    });
  }
});

// =====================================================
// GET ACCOUNT BALANCE
// =====================================================

router.get("/:publicKey", async (req, res) => {
  try {
    const data = await getBalance(req.params.publicKey);

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Conta não encontrada",
    });
  }
});

// =====================================================
// GET FORMATTED BALANCES (XLM + EPRW)
// =====================================================

router.get("/:publicKey/balances", async (req, res) => {
  const startedAt = Date.now();

  try {
    const data = await getBalance(req.params.publicKey);

    const rawBalances = Array.isArray(data.balances) ? data.balances : [];

    let xlmBalance = "0";
    let eprwBalance = "0";
    let eprwIssuer = null;
    let eprwLimit = null;
    let eprwTrustline = false;

    const assets = rawBalances.map((balance) => {
      if (balance.asset_type === "native") {
        xlmBalance = balance.balance || "0";

        return {
          asset_type: "native",
          asset_code: "XLM",
          asset_issuer: null,
          balance: balance.balance || "0",
          limit: null,
          is_authorized: true,
        };
      }

      if (balance.asset_code === "EPRW" || balance.asset_code === "EPWR") {
        eprwBalance = balance.balance || "0";
        eprwIssuer = balance.asset_issuer || null;
        eprwLimit = balance.limit || null;
        eprwTrustline = true;
      }

      return {
        asset_type: balance.asset_type || "credit_alphanum4",
        asset_code: balance.asset_code || "UNKNOWN",
        asset_issuer: balance.asset_issuer || null,
        balance: balance.balance || "0",
        limit: balance.limit || null,
        is_authorized: balance.is_authorized !== false,
      };
    });

    if (!assets.some((asset) => asset.asset_type === "native")) {
      assets.unshift({
        asset_type: "native",
        asset_code: "XLM",
        asset_issuer: null,
        balance: xlmBalance,
        limit: null,
        is_authorized: true,
      });
    }

    return res.json({
      success: true,
      wallet: req.params.publicKey,
      network: "stellar-testnet",
      account_funded: Number(xlmBalance) > 0,
      subentry_count: data.subentry_count || assets.length,
      assets,
      summary: {
        xlm: xlmBalance,
        eprw: eprwBalance,
        eprw_code: "EPRW",
        eprw_issuer: eprwIssuer,
        eprw_limit: eprwLimit,
        eprw_trustline: eprwTrustline,
      },
      balances: {
        xlm: xlmBalance,
        eprw: eprwBalance,
      },
      latency_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);

    return res.status(200).json({
      success: true,
      wallet: req.params.publicKey,
      network: "stellar-testnet",
      account_funded: false,
      subentry_count: 0,
      assets: [
        {
          asset_type: "native",
          asset_code: "XLM",
          asset_issuer: null,
          balance: "0",
          limit: null,
          is_authorized: true,
        },
      ],
      summary: {
        xlm: "0",
        eprw: "0",
        eprw_code: "EPRW",
        eprw_issuer: null,
        eprw_limit: null,
        eprw_trustline: false,
      },
      balances: {
        xlm: "0",
        eprw: "0",
      },
      latency_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
      note: "Wallet balance fallback response. Horizon balance lookup failed.",
    });
  }
});

// =====================================================
// CREATE TRUSTLINE
// =====================================================

router.post("/trustline", async (req, res) => {
  try {
    const { privateKey, issuerPublicKey } = req.body;

    const result = await createTrustline(privateKey, issuerPublicKey);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao criar trustline",
    });
  }
});

// =====================================================
// ISSUE TOKEN
// =====================================================

router.post("/issue", async (req, res) => {
  try {
    const { issuerPrivateKey, destinationPublic, amount } = req.body;

    const result = await issueToken(issuerPrivateKey, destinationPublic, amount);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao emitir token",
    });
  }
});

// =====================================================
// CREATE SELL OFFER (ASK)
// =====================================================

router.post("/offer", async (req, res) => {
  try {
    const { privateKey, amount, price, issuerPublicKey } = req.body;

    const result = await createSellOffer(privateKey, amount, price, issuerPublicKey);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao criar oferta",
    });
  }
});

// =====================================================
// CREATE BUY OFFER (BID)
// =====================================================

router.post("/buy-offer", async (req, res) => {
  try {
    const { privateKey, amount, price, issuerPublicKey } = req.body;

    const result = await createBuyOffer(privateKey, amount, price, issuerPublicKey);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao criar ordem de compra",
    });
  }
});

// =====================================================
// DIRECT BUY
// =====================================================

router.post("/buy", async (req, res) => {
  try {
    const { buyerPrivateKey, issuerPublicKey, amount, maxXlm } = req.body;

    const result = await buyEPRW({
      buyerSecret: buyerPrivateKey,

      issuerPublicKey,

      amountToReceive: amount,

      maxXlmSpend: maxXlm,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao comprar EPRW",
    });
  }
});

// =====================================================
// ORDERBOOK / PRICE
// =====================================================

router.get("/price/:issuerPublicKey", async (req, res) => {
  try {
    const data = await getOrderbook(req.params.issuerPublicKey);

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Erro ao obter preço",
    });
  }
});

export default router;
