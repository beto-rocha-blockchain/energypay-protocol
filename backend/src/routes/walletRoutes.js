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
  getOrderbook
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
    const data = await getBalance(
      req.params.publicKey
    );

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

router.get(
  "/:publicKey/balances",
  async (req, res) => {
    try {
      const data = await getBalance(
        req.params.publicKey
      );

      const balances =
        data.balances || [];

      let xlmBalance = "0";
      let eprwBalance = "0";

      for (const balance of balances) {
        // Native XLM
        if (
          balance.asset_type ===
          "native"
        ) {
          xlmBalance =
            balance.balance;
        }

        // EPRW token
        if (
          balance.asset_code ===
          "EPRW"
        ) {
          eprwBalance =
            balance.balance;
        }
      }

      return res.json({
        success: true,

        wallet:
          req.params.publicKey,

        balances: {
          xlm: xlmBalance,
          eprw: eprwBalance,
        },
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        error:
          "Erro ao obter balances",
      });
    }
  }
);

// =====================================================
// CREATE TRUSTLINE
// =====================================================

router.post(
  "/trustline",
  async (req, res) => {
    try {
      const {
        privateKey,
        issuerPublicKey,
      } = req.body;

      const result =
        await createTrustline(
          privateKey,
          issuerPublicKey
        );

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error:
          "Erro ao criar trustline",
      });
    }
  }
);

// =====================================================
// ISSUE TOKEN
// =====================================================

router.post("/issue", async (req, res) => {
  try {
    const {
      issuerPrivateKey,
      destinationPublic,
      amount,
    } = req.body;

    const result = await issueToken(
      issuerPrivateKey,
      destinationPublic,
      amount
    );

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
    const {
      privateKey,
      amount,
      price,
      issuerPublicKey,
    } = req.body;

    const result =
      await createSellOffer(
        privateKey,
        amount,
        price,
        issuerPublicKey
      );

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error:
        "Erro ao criar oferta",
    });
  }
});

// =====================================================
// CREATE BUY OFFER (BID)
// =====================================================

router.post(
  "/buy-offer",
  async (req, res) => {
    try {
      const {
        privateKey,
        amount,
        price,
        issuerPublicKey,
      } = req.body;

      const result =
        await createBuyOffer(
          privateKey,
          amount,
          price,
          issuerPublicKey
        );

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error:
          "Erro ao criar ordem de compra",
      });
    }
  }
);

// =====================================================
// DIRECT BUY
// =====================================================

router.post("/buy", async (req, res) => {
  try {
    const {
      buyerPrivateKey,
      issuerPublicKey,
      amount,
      maxXlm,
    } = req.body;

    const result = await buyEPRW({
      buyerSecret:
        buyerPrivateKey,

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
      error:
        "Erro ao comprar EPRW",
    });
  }
});

// =====================================================
// ORDERBOOK / PRICE
// =====================================================

router.get(
  "/price/:issuerPublicKey",
  async (req, res) => {
    try {
      const data =
        await getOrderbook(
          req.params.issuerPublicKey
        );

      res.json({
        success: true,
        ...data,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error:
          "Erro ao obter preço",
      });
    }
  }
);

export default router;