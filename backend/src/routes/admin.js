/**
 * Admin routes — account lifecycle management.
 *
 * POST /api/admin/cleanup-inactive
 *   Deletes accounts that have been inactive for 7+ days:
 *   - No settlements as buyer or seller
 *   - No funded Stellar account (or balance === 0)
 *
 *   For funded accounts, merges the Stellar account back into
 *   the operator, recovering the XLM reserve.
 */

import express from "express";
import {
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { supabase } from "../lib/supabase.js";
import { NETWORK_PASSPHRASE, horizon } from "../lib/stellar-network.js";

const router = express.Router();

const INACTIVITY_DAYS = 7;

/** Accounts that must never be deleted (operator, distribution, legacy testnet keys). */
const PROTECTED_ACCOUNTS = new Set([
  "GCBV4JEMUWJH54KWVIGQ56ULHYBT44BJMBWAKABD7KVXFQ4QCT53V2DV",
  "GAC6EW2V5SCW3EEBDNFJSRKIFP7EMI7LYPIX2X3QXWQER4FPQVZGEPUA",
  "GD2S4MPDYMCSPUPPAJ4RULAGVE6PF2Q5HRNT6ELLQYBXKYKO4D646V4S",
  "GDJM2O2NBMZNDQ46EOCAG3WLOCGA2PKP7KOBK4SOTYXDUHNZ5NLIMAM2",
]);

/**
 * Attempt to merge a Stellar account back into the operator,
 * recovering XLM. If the account doesn't exist on-chain or has
 * trustlines that prevent merging, we skip gracefully.
 */
async function mergeAccountIntoOperator(userSecret, operatorPublic) {
  try {
    const userKeypair = Keypair.fromSecret(userSecret);
    const userPublic = userKeypair.publicKey();

    // Check if account exists on-chain
    let account;
    try {
      account = await horizon.loadAccount(userPublic);
    } catch {
      // Account doesn't exist on-chain — nothing to merge
      return { merged: false, reason: "account_not_found" };
    }

    // Remove any trustlines first (required before merge)
    const nonNativeBalances = account.balances.filter(
      (b) => b.asset_type !== "native"
    );

    if (nonNativeBalances.length > 0) {
      const removeTrustTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      for (const bal of nonNativeBalances) {
        // If balance > 0, send it back to issuer or skip
        if (parseFloat(bal.balance) > 0) {
          // Can't remove trustline with balance — skip merge
          return { merged: false, reason: "has_token_balance" };
        }
        removeTrustTx.addOperation(
          Operation.changeTrust({
            asset: new (await import("@stellar/stellar-sdk")).Asset(
              bal.asset_code,
              bal.asset_issuer
            ),
            limit: "0",
          })
        );
      }

      const builtRemove = removeTrustTx.setTimeout(30).build();
      builtRemove.sign(userKeypair);
      await horizon.submitTransaction(builtRemove);

      // Reload account after trustline removal
      account = await horizon.loadAccount(userPublic);
    }

    // Merge account into operator
    const mergeTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.accountMerge({ destination: operatorPublic })
      )
      .setTimeout(30)
      .build();

    mergeTx.sign(userKeypair);
    await horizon.submitTransaction(mergeTx);

    return { merged: true, recovered: account.balances.find((b) => b.asset_type === "native")?.balance ?? "0" };
  } catch (err) {
    return { merged: false, reason: err.message?.slice(0, 120) };
  }
}

/**
 * POST /api/admin/cleanup-inactive
 *
 * Body (optional):
 *   { "dry_run": true }   — preview only, don't delete
 *   { "days": 14 }        — override inactivity threshold
 */
router.post("/cleanup-inactive", async (req, res) => {
  try {
    const operatorSecret = (
      process.env.OPERATOR_SECRET ||
      process.env.STELLAR_SECRET ||
      ""
    ).trim();

    if (!operatorSecret) {
      return res.status(500).json({
        success: false,
        error: "OPERATOR_SECRET not configured",
      });
    }

    const operatorPublic = Keypair.fromSecret(operatorSecret).publicKey();
    const dryRun = req.body?.dry_run === true;
    const days = Number(req.body?.days) || INACTIVITY_DAYS;

    // 1. Find users created more than N days ago
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();

    const { data: candidates, error: fetchErr } = await supabase
      .from("users")
      .select("id, email, full_name, stellar_public_key, stellar_secret_encrypted, stellar_funded, created_at")
      .lt("created_at", cutoffISO);

    if (fetchErr) {
      return res.status(500).json({ success: false, error: fetchErr.message });
    }

    if (!candidates || candidates.length === 0) {
      return res.json({
        success: true,
        message: "No candidates found",
        deleted: 0,
        checked: 0,
      });
    }

    // 2. For each candidate, check if they have any settlements
    const results = [];

    for (const user of candidates) {
      // Skip operator and protected accounts
      if (
        user.stellar_public_key === operatorPublic ||
        PROTECTED_ACCOUNTS.has(user.stellar_public_key)
      ) {
        results.push({
          email: user.email,
          action: "kept",
          reason: "protected account",
        });
        continue;
      }

      // Check settlements as buyer (user id)
      const { count: buyerCount } = await supabase
        .from("settlements")
        .select("id", { count: "exact", head: true })
        .eq("buyer", user.id);

      // Check settlements as seller (stellar public key)
      const { count: sellerCount } = await supabase
        .from("settlements")
        .select("id", { count: "exact", head: true })
        .eq("seller", user.stellar_public_key);

      const totalSettlements = (buyerCount ?? 0) + (sellerCount ?? 0);

      if (totalSettlements > 0) {
        results.push({
          email: user.email,
          action: "kept",
          reason: `${totalSettlements} settlement(s) found`,
        });
        continue;
      }

      // Check on-chain balance
      let hasFunds = false;
      try {
        const acct = await horizon.loadAccount(user.stellar_public_key);
        const xlm = acct.balances.find((b) => b.asset_type === "native");
        hasFunds = xlm && parseFloat(xlm.balance) > 1.0; // more than base reserve
      } catch {
        // Account not found on-chain
      }

      if (hasFunds) {
        results.push({
          email: user.email,
          action: "kept",
          reason: "account has XLM balance on-chain",
        });
        continue;
      }

      // This account qualifies for deletion
      if (dryRun) {
        results.push({
          email: user.email,
          action: "would_delete",
          reason: `inactive ${days}+ days, no settlements, no funds`,
        });
        continue;
      }

      // 3. Attempt Stellar account merge if it exists on-chain
      let mergeResult = { merged: false, reason: "no_secret" };
      if (user.stellar_secret_encrypted) {
        mergeResult = await mergeAccountIntoOperator(
          user.stellar_secret_encrypted,
          operatorPublic
        );
      }

      // 4. Delete user from Supabase
      const { error: delErr } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (delErr) {
        results.push({
          email: user.email,
          action: "error",
          reason: `delete failed: ${delErr.message}`,
        });
        continue;
      }

      results.push({
        email: user.email,
        action: "deleted",
        stellar_merge: mergeResult,
        reason: `inactive ${days}+ days, no settlements, no funds`,
      });
    }

    const deleted = results.filter((r) => r.action === "deleted").length;
    const kept = results.filter((r) => r.action === "kept").length;

    return res.json({
      success: true,
      dry_run: dryRun,
      days_threshold: days,
      checked: candidates.length,
      deleted,
      kept,
      results,
    });
  } catch (err) {
    console.error("[admin/cleanup-inactive]", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
