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

// 🔐 Criar wallet
router.post("/create", async (req, res) => {
  try {
    const wallet = createWallet();
    await fundAccount(wallet.publicKey);
    res.json(wallet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar wallet" });
  }
});

// 💰 Saldo
router.get("/:publicKey", async (req, res) => {
  try {
    const data = await getBalance(req.params.publicKey);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Conta não encontrada" });
  }
});

// 🔗 Trustline
router.post("/trustline", async (req, res) => {
  try {
    const { privateKey, issuerPublicKey } = req.body;

    const result = await createTrustline(
      privateKey,
      issuerPublicKey
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar trustline" });
  }
});

// 🪙 Emissão
router.post("/issue", async (req, res) => {
  try {
    const { issuerPrivateKey, destinationPublic, amount } = req.body;

    const result = await issueToken(
      issuerPrivateKey,
      destinationPublic,
      amount
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao emitir token" });
  }
});

// 📊 SELL (ASK)
router.post("/offer", async (req, res) => {
  try {
    const { privateKey, amount, price, issuerPublicKey } = req.body;

    const result = await createSellOffer(
      privateKey,
      amount,
      price,
      issuerPublicKey
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar oferta" });
  }
});

// 📊 BUY (BID)
router.post("/buy-offer", async (req, res) => {
  try {
    const { privateKey, amount, price, issuerPublicKey } = req.body;

    const result = await createBuyOffer(
      privateKey,
      amount,
      price,
      issuerPublicKey
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar ordem de compra" });
  }
});

// 💸 Compra direta
router.post("/buy", async (req, res) => {
  try {
    const { buyerPrivateKey, issuerPublicKey, amount, maxXlm } = req.body;

    const result = await buyEPRW({
      buyerSecret: buyerPrivateKey,
      issuerPublicKey,
      amountToReceive: amount,
      maxXlmSpend: maxXlm
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao comprar EPRW" });
  }
});

// 📊 Preço
router.get("/price/:issuerPublicKey", async (req, res) => {
  try {
    const data = await getOrderbook(req.params.issuerPublicKey);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter preço" });
  }
});

export default router;