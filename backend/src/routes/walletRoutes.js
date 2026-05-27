import express from "express";
import { NETWORK_LABEL, NETWORK_NAME, HORIZON_URL } from "../lib/stellar-network.js";

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

        network: NETWORK_LABEL,
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
// GET WALLET ACTIVITY FEED — real Horizon operations
// =====================================================

const classifyHorizonOp = (op, account) => {
  const successful = op.transaction_successful !== false;
  let kind = "OTHER";
  let title = (op.type || "").replace(/_/g, " ").toUpperCase();
  let detail = "";
  let asset = null;
  let amount = null;
  let counterparty = null;
  const severity = successful ? "ok" : "critical";

  switch (op.type) {
    case "create_account":
      kind = "FUNDING";
      title = "Account Funded";
      amount = op.starting_balance ?? null;
      asset = "XLM";
      counterparty = op.funder ?? null;
      detail = `${amount ?? "—"} XLM seeded into settlement account.`;
      break;
    case "payment": {
      const code = op.asset_type === "native" ? "XLM" : (op.asset_code ?? "—");
      const incoming = op.to === account;
      asset = code;
      amount = op.amount ?? null;
      counterparty = incoming ? (op.from ?? null) : (op.to ?? null);
      const isIssuance = code === "EPWR" && op.asset_issuer && op.from === op.asset_issuer && op.to === account;
      if (isIssuance) {
        kind = "ISSUANCE";
        title = "EPWR Issued";
        detail = `${amount ?? "—"} EPWR minted from issuer.`;
      } else {
        kind = "SETTLEMENT";
        title = incoming ? `Settlement Received · ${code}` : `Settlement Sent · ${code}`;
        detail = incoming
          ? `${amount ?? "—"} ${code} received.`
          : `${amount ?? "—"} ${code} dispatched.`;
      }
      break;
    }
    case "change_trust":
      kind = "TRUSTLINE";
      asset = op.asset_code ?? "—";
      title = op.limit === "0" || op.limit === "0.0000000"
        ? `Trustline Removed · ${asset}`
        : `Trustline Established · ${asset}`;
      detail = `Operator updated ${asset} trustline.`;
      break;
    case "manage_sell_offer":
    case "manage_buy_offer":
    case "create_passive_sell_offer":
      kind = "OFFER";
      asset = `${op.selling_asset_code ?? "XLM"}/${op.buying_asset_code ?? "XLM"}`;
      title = `DEX Offer · ${asset}`;
      detail = `Order book activity at price ${op.price ?? "—"}.`;
      break;
    default:
      detail = `Stellar operation of type ${op.type}.`;
  }

  return {
    id: op.id,
    tx_hash: op.transaction_hash,
    ledger: 0,
    created_at: op.created_at,
    kind,
    severity,
    title,
    detail,
    asset,
    amount,
    counterparty,
    successful,
  };
};

router.get("/:publicKey/activity", async (req, res) => {
  const startedAt = Date.now();
  const { publicKey } = req.params;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

  try {
    const url = `${HORIZON_URL}/accounts/${publicKey}/operations?order=desc&limit=${limit}&include_failed=true`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    let horizonRes;
    try {
      horizonRes = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (horizonRes.status === 404) {
      return res.json({
        success: true,
        wallet: publicKey,
        events: [],
        latency_ms: Date.now() - startedAt,
        checked_at: new Date().toISOString(),
        note: "Account not yet on ledger.",
      });
    }

    if (!horizonRes.ok) {
      return res.status(502).json({
        success: false,
        error: `Horizon HTTP ${horizonRes.status}`,
        latency_ms: Date.now() - startedAt,
      });
    }

    const body = await horizonRes.json();
    const records = body?._embedded?.records ?? [];
    const events = records.map((op) => classifyHorizonOp(op, publicKey));

    return res.json({
      success: true,
      wallet: publicKey,
      events,
      latency_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(504).json({
      success: false,
      error: "HORIZON_UNREACHABLE",
      message: err.message,
      latency_ms: Date.now() - startedAt,
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
      network: NETWORK_NAME,
      account_funded: Number(xlmBalance) > 0,
      subentry_count: data.subentry_count || assets.length,
      assets,
      summary: {
        xlm: xlmBalance,
        eprw: eprwBalance,
        eprw_code: "EPWR",
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
      network: NETWORK_NAME,
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
        eprw_code: "EPWR",
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
