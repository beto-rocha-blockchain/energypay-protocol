import express from "express";
import jwt from "jsonwebtoken";

import {
  atomicTokenizeContract,
  buyEPWRWithXLMForUser,
  sellEPWRForXLMForUser,
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

import { supabase } from "../lib/supabase.js";
import {
  horizon,
  NETWORK_PASSPHRASE,
} from "../lib/stellar-network.js";
import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";

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

// Creates EPWR trustline for an arbitrary account (requires its secret).
router.post("/trustline/account", async (req, res) => {
  const { secret } = req.body ?? {};

  const result = await createTrustlineForAccount(secret);
  res.status(result.success ? 200 : 400).json(result);
});

// Creates EPWR trustline for the currently authenticated user.
// Looks up the user's secret from Supabase and signs on their behalf.
// Also funds the account with minimum XLM from the Operator if unfunded.
router.post("/trustline/me", requireAuth, async (req, res) => {
  try {
    const userId = req.operator?.sub || req.operator?.id;
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
        error: "User wallet not found.",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.stellar_secret_encrypted) {
      return res.status(422).json({
        success: false,
        error: "User wallet secret not available.",
        code: "SECRET_MISSING",
      });
    }

    // Ensure account exists and has enough XLM for trustline reserves
    const operatorSecret = (process.env.OPERATOR_SECRET || process.env.STELLAR_SECRET || "").trim();
    let accountFunded = false;
    let existingAccount = null;

    try {
      existingAccount = await horizon.loadAccount(user.stellar_public_key);
      accountFunded = true;
    } catch {
      // Account doesn't exist on this network — create it from Operator
      if (!operatorSecret) {
        return res.status(422).json({
          success: false,
          error: "Account not funded and no Operator key configured.",
          code: "ACCOUNT_NOT_FUNDED",
        });
      }
      try {
        const operatorKP = Keypair.fromSecret(operatorSecret);
        const operatorAccount = await horizon.loadAccount(operatorKP.publicKey());
        const fundTx = new TransactionBuilder(operatorAccount, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            Operation.createAccount({
              destination: user.stellar_public_key,
              startingBalance: "3",
            }),
          )
          .setTimeout(30)
          .build();
        fundTx.sign(operatorKP);
        await horizon.submitTransaction(fundTx);
        accountFunded = true;
        console.log(`Created ${user.stellar_public_key} with 3 XLM from Operator`);
      } catch (fundErr) {
        return res.status(400).json({
          success: false,
          error: `Failed to fund account: ${fundErr.message}`,
          code: "FUNDING_FAILED",
        });
      }
    }

    // If account exists but has low reserve, top it up so trustline doesn't fail
    if (existingAccount && operatorSecret) {
      const nativeBalance = existingAccount.balances.find(b => b.asset_type === "native");
      const xlm = Number(nativeBalance?.balance ?? 0);
      // Need: 1 base reserve + 0.5 per subentry (existing + 1 new trustline) + 0.1 buffer
      const neededReserve = 1 + (existingAccount.subentry_count + 1) * 0.5 + 0.1;
      if (xlm < neededReserve) {
        const topUp = (neededReserve - xlm + 0.5).toFixed(7);
        try {
          const operatorKP = Keypair.fromSecret(operatorSecret);
          const operatorAccount = await horizon.loadAccount(operatorKP.publicKey());
          const topTx = new TransactionBuilder(operatorAccount, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.payment({
                destination: user.stellar_public_key,
                asset: Asset.native(),
                amount: topUp,
              }),
            )
            .setTimeout(30)
            .build();
          topTx.sign(operatorKP);
          await horizon.submitTransaction(topTx);
          console.log(`Topped up ${user.stellar_public_key} with ${topUp} XLM`);
        } catch (topErr) {
          console.warn("Top-up failed (non-fatal):", topErr.message);
        }
      }
    }

    const result = await createTrustlineForSecret(
      user.stellar_secret_encrypted,
      "user-trustline-created",
    );

    return res.status(result.success ? 200 : 400).json({
      ...result,
      user_id: user.id,
      public_key: user.stellar_public_key,
      account_funded: accountFunded,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      code: "TRUSTLINE_ME_FAILED",
    });
  }
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

router.post("/sell/me", requireAuth, async (req, res) => {
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

    const result = await sellEPWRForXLMForUser(
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
      code: error.code || "EPWR_SELL_FAILED",
    });
  }
});

router.get("/balances", async (req, res) => {
  const result = await getDistributionBalances();
  res.status(result.success ? 200 : 400).json(result);
});

router.post("/atomic-tokenize", requireAuth, async (req, res) => {
  try {
    const userId = req.operator?.sub || req.operator?.id;
    const {
      contract_number,
      buyer_public_key,
      seller_public_key,
      volume_mwh,
      price_brl,
      start_date,
      end_date,
      settlement_date,
      memo,
    } = req.body ?? {};

    if (!volume_mwh || !price_brl) {
      return res.status(422).json({
        success: false,
        error: "volume_mwh and price_brl are required.",
        code: "MISSING_FIELDS",
      });
    }

    let buyerPK = buyer_public_key;
    let sellerPK = seller_public_key;

    if (!buyerPK && userId) {
      const { data: user } = await supabase
        .from("users")
        .select("stellar_public_key")
        .eq("id", userId)
        .single();
      buyerPK = user?.stellar_public_key;
    }

    if (!buyerPK) {
      return res.status(422).json({
        success: false,
        error: "buyer_public_key is required (or authenticate as buyer).",
        code: "MISSING_BUYER",
      });
    }

    if (!sellerPK) {
      sellerPK = getDistributionAddress();
    }

    // ------------------------------------------------------------------
    // Auto-provision EPWR trustline for buyer if missing.
    // Registration tries to do this, but it is non-fatal there, so we
    // repeat it here before the atomic tx to prevent op_no_trust failures.
    // ------------------------------------------------------------------
    try {
      const issuerPK = getEPWRAssetInfo().issuer;
      const buyerAccountData = await horizon.loadAccount(buyerPK).catch(() => null);

      const hasTrustline = buyerAccountData?.balances?.some(
        (b) => b.asset_code === "EPWR" && b.asset_issuer === issuerPK,
      );

      if (!hasTrustline) {
        const { data: buyerRecord } = await supabase
          .from("users")
          .select("id, stellar_secret_encrypted")
          .eq("stellar_public_key", buyerPK)
          .single();

        if (!buyerRecord?.stellar_secret_encrypted) {
          return res.status(422).json({
            success: false,
            error:
              `Buyer wallet (${buyerPK.slice(0, 8)}…) does not have an EPWR trustline. ` +
              `Open Custody Wallet → "Enable EPWR" first.`,
            code: "BUYER_NO_TRUSTLINE",
          });
        }

        const operatorSecret = (
          process.env.OPERATOR_SECRET ||
          process.env.STELLAR_SECRET ||
          ""
        ).trim();

        if (!buyerAccountData) {
          // Account doesn't exist on-chain yet — fund it from operator
          if (!operatorSecret) {
            return res.status(422).json({
              success: false,
              error: "Buyer account is not funded and no operator key is configured.",
              code: "BUYER_ACCOUNT_NOT_FUNDED",
            });
          }
          try {
            const operatorKP = Keypair.fromSecret(operatorSecret);
            const operatorAccount = await horizon.loadAccount(operatorKP.publicKey());
            const fundTx = new TransactionBuilder(operatorAccount, {
              fee: BASE_FEE,
              networkPassphrase: NETWORK_PASSPHRASE,
            })
              .addOperation(
                Operation.createAccount({
                  destination: buyerPK,
                  startingBalance: "3",
                }),
              )
              .setTimeout(30)
              .build();
            fundTx.sign(operatorKP);
            await horizon.submitTransaction(fundTx);
            console.log(`[atomic-tokenize] Created buyer account ${buyerPK} with 3 XLM`);
          } catch (fundErr) {
            console.warn("[atomic-tokenize] Buyer account funding failed:", fundErr.message);
          }
        } else if (operatorSecret) {
          // Account exists — top up XLM reserve if needed for trustline subentry
          const nativeBal = buyerAccountData.balances.find((b) => b.asset_type === "native");
          const xlm = Number(nativeBal?.balance ?? 0);
          const neededReserve = 1 + (buyerAccountData.subentry_count + 1) * 0.5 + 0.1;
          if (xlm < neededReserve) {
            const topUp = (neededReserve - xlm + 0.5).toFixed(7);
            try {
              const operatorKP = Keypair.fromSecret(operatorSecret);
              const operatorAccount = await horizon.loadAccount(operatorKP.publicKey());
              const topTx = new TransactionBuilder(operatorAccount, {
                fee: BASE_FEE,
                networkPassphrase: NETWORK_PASSPHRASE,
              })
                .addOperation(
                  Operation.payment({
                    destination: buyerPK,
                    asset: Asset.native(),
                    amount: topUp,
                  }),
                )
                .setTimeout(30)
                .build();
              topTx.sign(operatorKP);
              await horizon.submitTransaction(topTx);
              console.log(
                `[atomic-tokenize] Topped up buyer ${buyerPK} with ${topUp} XLM for trustline reserve`,
              );
            } catch (topErr) {
              console.warn("[atomic-tokenize] Buyer top-up non-fatal:", topErr.message);
            }
          }
        }

        // Create the trustline with the buyer's own keypair
        const trustResult = await createTrustlineForSecret(
          buyerRecord.stellar_secret_encrypted,
          "buyer-auto-trustline",
        );

        if (trustResult.success) {
          console.log(`[atomic-tokenize] Auto-created EPWR trustline for buyer ${buyerPK}`);
        } else {
          console.warn(
            `[atomic-tokenize] Auto-trustline failed for buyer ${buyerPK}: ${trustResult.error}`,
          );
          return res.status(422).json({
            success: false,
            error: `Buyer wallet EPWR trustline setup failed: ${trustResult.error}`,
            code: "BUYER_TRUSTLINE_FAILED",
          });
        }
      }
    } catch (trustCheckErr) {
      // Non-fatal — log and let atomicTokenizeContract surface the real Horizon error
      console.warn("[atomic-tokenize] Trustline pre-check error:", trustCheckErr.message);
    }

    const t0 = Date.now();
    const result = await atomicTokenizeContract({
      buyerPublicKey: buyerPK,
      sellerPublicKey: sellerPK,
      volumeMWh: volume_mwh,
      priceBRL: price_brl,
      contractNumber: contract_number,
      startDate: start_date,
      endDate: end_date,
      settlementDate: settlement_date,
      memo,
    });
    const finalityMs = Date.now() - t0;

    // Persist the contract to DB if tokenization succeeded
    if (result.success) {
      try {
        // Resolve buyer_id from public key
        let buyerId = userId;
        const { data: buyerUser } = await supabase
          .from("users")
          .select("id")
          .eq("stellar_public_key", buyerPK)
          .single();
        if (buyerUser?.id) buyerId = buyerUser.id;

        let sellerId = null;
        if (sellerPK) {
          const { data: sellerUser } = await supabase
            .from("users")
            .select("id")
            .eq("stellar_public_key", sellerPK)
            .single();
          sellerId = sellerUser?.id ?? null;
        }

        const { data: newContract } = await supabase
          .from("contracts")
          .insert({
            contract_number: contract_number ?? null,
            buyer_id: buyerId,
            seller_id: sellerId,
            buyer_public_key: buyerPK,
            seller_public_key: sellerPK,
            volume_mwh: Number(volume_mwh),
            price_brl: Number(price_brl),
            pld_brl: Number(price_brl),
            start_date: start_date ?? null,
            end_date: end_date ?? null,
            settlement_date: settlement_date ?? null,
            status: "SETTLED",
            state: "SETTLED",
            tx_hash: result.hash,
            ledger: result.ledger,
            finality_ms: finalityMs,
            memo: memo ?? null,
            created_by: userId,
          })
          .select("id")
          .single();

        if (newContract?.id) {
          // Record the settlement movement
          await supabase.from("contract_movements").insert({
            contract_id: newContract.id,
            from_state: null,
            to_state: "SETTLED",
            actor_user_id: userId,
            notes: `Atomic tokenization complete. Ledger #${result.ledger}`,
            tx_hash: result.hash,
            ledger: result.ledger,
          });

          // Also persist to settlements table for reconciliation feed (non-fatal)
          const { error: settlErr } = await supabase.from("settlements").insert({
            settlement_id: `CNT-${newContract.id.slice(0, 8)}`,
            contract_id: newContract.id,
            buyer: buyerPK,
            seller: sellerPK,
            amount_brl: Number(volume_mwh) * Number(price_brl),
            volume_mwh: Number(volume_mwh),
            pld: Number(price_brl),
            tx_hash: result.hash,
            ledger: result.ledger,
            finality_ms: finalityMs,
            status: "SETTLED",
          });
          if (settlErr) console.warn("settlements insert non-fatal:", settlErr.message);

          result.contract_id = newContract.id;

          // ── Notifications: inform buyer and seller of the settled contract ──
          const contractRef = contract_number
            ? `#${contract_number}`
            : newContract.id.slice(0, 8).toUpperCase();
          const settledTitle = `Contract ${contractRef} settled on Stellar`;
          const actionUrl = `/contracts`;

          const notifyUser = async (notifyUserId, role) => {
            if (!notifyUserId) return;
            try {
              await supabase.from("notifications").insert({
                user_id: notifyUserId,
                contract_id: newContract.id,
                type: "SETTLED",
                title: settledTitle,
                message:
                  `As ${role}, your energy contract (${volume_mwh} MWh @ R$${price_brl}/MWh) ` +
                  `was atomically tokenized and settled on Stellar. ` +
                  `Tx: ${result.hash?.slice(0, 12)}… · Ledger #${result.ledger}`,
                action_label: "View Contract",
                action_url: actionUrl,
              });
            } catch (notifErr) {
              console.warn(`[atomic-tokenize] Notification non-fatal (${role}):`, notifErr.message);
            }
          };

          await notifyUser(buyerId, "BUYER");
          if (sellerId && sellerId !== buyerId) {
            await notifyUser(sellerId, "SELLER");
          }
        }
      } catch (persistErr) {
        // Non-fatal — Stellar TX already confirmed, just log
        console.warn("Contract DB persist non-fatal:", persistErr.message);
      }
    }

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Atomic tokenize route error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      code: "ATOMIC_TOKENIZE_ERROR",
    });
  }
});

export default router;

