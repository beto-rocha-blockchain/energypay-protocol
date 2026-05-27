import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";
import { horizon, NETWORK_LABEL, IS_MAINNET } from "../lib/stellar-network.js";

const router = express.Router();

const optionalAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      req.operator = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch {
    /* no-op */
  }
  return next();
};

// =====================================================
// GET /api/dashboard/stats
// Aggregated stats for the Executive Ops page
// =====================================================
router.get("/stats", optionalAuth, async (req, res) => {
  try {
    // Contracts count (table may not exist yet — handle gracefully)
    let activeContracts = 0;
    let totalContracts = 0;
    try {
      const { count: ac } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIVE");
      activeContracts = ac || 0;

      const { count: tc } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true });
      totalContracts = tc || 0;
    } catch {
      /* contracts table may not exist */
    }

    // Settlements (table may not exist yet)
    let settlements = [];
    let totalSettlements = 0;
    try {
      const { data, count } = await supabase
        .from("settlements")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(100);
      settlements = data || [];
      totalSettlements = count || 0;
    } catch {
      /* settlements table may not exist */
    }

    const settledSettlements = (settlements || []).filter(
      (s) => s.status === "SETTLED" || s.status === "CONFIRMED",
    );
    const failedSettlements = (settlements || []).filter((s) => s.status === "FAILED");

    // Volume & value
    const totalVolumeMWh = (settlements || []).reduce(
      (sum, s) => sum + Number(s.volume_mwh || 0),
      0,
    );
    const totalValueBRL = (settlements || []).reduce(
      (sum, s) => sum + Number(s.amount_brl || 0),
      0,
    );

    // Avg finality
    const finalityValues = (settlements || [])
      .map((s) => Number(s.finality_ms || s.latency_ms || 0))
      .filter((v) => v > 0);
    const avgFinalityMs =
      finalityValues.length > 0
        ? Math.round(finalityValues.reduce((a, b) => a + b, 0) / finalityValues.length)
        : 0;

    // Users count
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    res.json({
      success: true,
      stats: {
        active_contracts: activeContracts || 0,
        total_contracts: totalContracts || 0,
        total_settlements: totalSettlements || 0,
        settled_count: settledSettlements.length,
        failed_count: failedSettlements.length,
        total_volume_mwh: totalVolumeMWh,
        total_value_brl: totalValueBRL,
        avg_finality_ms: avgFinalityMs,
        total_users: totalUsers || 0,
        network: NETWORK_LABEL,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/dashboard/settlements
// Recent settlements for the table and feed
// =====================================================
router.get("/settlements", optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const { data, error } = await supabase
      .from("settlements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Table may not exist — return empty list
      return res.json({ success: true, settlements: [], checked_at: new Date().toISOString() });
    }

    res.json({
      success: true,
      settlements: (data || []).map((s) => ({
        id: s.settlement_id || s.id,
        contract_id: s.contract_id,
        buyer: s.buyer,
        seller: s.seller,
        amount_brl: Number(s.amount_brl || 0),
        volume_mwh: Number(s.volume_mwh || 0),
        pld: Number(s.pld || 0),
        tx_hash: s.tx_hash,
        ledger: s.ledger,
        status: s.status,
        created_at: s.created_at,
      })),
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Dashboard settlements error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/dashboard/contracts
// All contracts for the dashboard
// =====================================================
router.get("/contracts", optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      contracts: data || [],
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Dashboard contracts error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/dashboard/horizon
// Live Horizon status and operator balance
// =====================================================
router.get("/horizon", async (req, res) => {
  const started = Date.now();
  try {
    const operatorPK = (
      process.env.STELLAR_DESTINATION || ""
    ).trim();

    let operatorBalance = null;
    if (operatorPK) {
      try {
        const account = await horizon.loadAccount(operatorPK);
        operatorBalance = {};
        for (const b of account.balances) {
          if (b.asset_type === "native") operatorBalance.xlm = b.balance;
          else if (b.asset_code === "EPWR") operatorBalance.epwr = b.balance;
        }
      } catch {
        /* account not found */
      }
    }

    // Distribution account holds the EPWR treasury
    let distributionBalance = null;
    try {
      const { getDistributionAddress } = await import("../services/tokenService.js");
      const distPK = getDistributionAddress();
      if (distPK) {
        const distAccount = await horizon.loadAccount(distPK);
        distributionBalance = {};
        for (const b of distAccount.balances) {
          if (b.asset_type === "native") distributionBalance.xlm = b.balance;
          else if (b.asset_code === "EPWR") distributionBalance.epwr = b.balance;
        }
      }
    } catch {
      /* distribution not available */
    }

    res.json({
      success: true,
      horizon_online: true,
      latency_ms: Date.now() - started,
      network: NETWORK_LABEL,
      operator_balance: operatorBalance,
      distribution_balance: distributionBalance,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      success: true,
      horizon_online: false,
      latency_ms: Date.now() - started,
      network: NETWORK_LABEL,
      error: err.message,
      checked_at: new Date().toISOString(),
    });
  }
});

// =====================================================
// GET /api/dashboard/risk-snapshot
// Participant Risk Snapshot — real aggregated data only.
// Requires authentication. Returns verification counts,
// settlement reliability metrics, and netting eligibility
// derived from actual Supabase data.
// =====================================================
const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required" });
    req.operator = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

router.get("/risk-snapshot", requireAuth, async (req, res) => {
  try {
    // 1. Total registered users
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // 2. Fully verified participants (email + phone)
    const { count: verifiedCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("email_verified", true)
      .eq("phone_verified", true);

    // 3. Partially verified (email only, phone pending)
    const { count: emailOnlyCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("email_verified", true)
      .eq("phone_verified", false);

    // 4. Unverified (neither email nor phone)
    const unverifiedCount = (totalUsers || 0) - (verifiedCount || 0) - (emailOnlyCount || 0);

    // 5. Settlement reliability from real settlement data
    let settledCount = 0;
    let failedCount = 0;
    let totalSettlements = 0;
    try {
      const { data: settlements } = await supabase
        .from("settlements")
        .select("status");
      if (settlements) {
        totalSettlements = settlements.length;
        settledCount = settlements.filter(
          (s) => s.status === "SETTLED" || s.status === "CONFIRMED"
        ).length;
        failedCount = settlements.filter((s) => s.status === "FAILED").length;
      }
    } catch { /* settlements table may not exist */ }

    const settlementReliability = totalSettlements > 0
      ? Math.round((settledCount / totalSettlements) * 10000) / 100
      : null;

    // 6. Active contracts
    let activeContracts = 0;
    try {
      const { count } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIVE");
      activeContracts = count || 0;
    } catch { /* contracts table may not exist */ }

    // 7. Netting eligibility: verified participants with at least 1 settlement
    let nettingEligible = null;
    try {
      const { data: settlementsWithSellers } = await supabase
        .from("settlements")
        .select("seller, buyer");
      if (settlementsWithSellers) {
        const uniqueParticipants = new Set();
        settlementsWithSellers.forEach((s) => {
          if (s.seller) uniqueParticipants.add(s.seller);
          if (s.buyer) uniqueParticipants.add(s.buyer);
        });
        nettingEligible = uniqueParticipants.size;
      }
    } catch { /* ok */ }

    res.json({
      success: true,
      snapshot: {
        total_registered: totalUsers || 0,
        verified_participants: verifiedCount || 0,
        partially_verified: emailOnlyCount || 0,
        unverified: unverifiedCount,
        total_settlements: totalSettlements,
        settled_count: settledCount,
        failed_count: failedCount,
        settlement_reliability_pct: settlementReliability,
        active_contracts: activeContracts,
        netting_eligible_participants: nettingEligible,
        // Not available — no backend risk engine, collateral, or moderation system
        collateral_coverage: null,
        risk_tiers: null,
        watchlist_count: null,
        blocked_count: null,
        avg_settlement_score: null,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Risk snapshot error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GET /api/dashboard/counterparty-risk
// Per-participant risk profile for contract due diligence.
// Requires authentication + full verification.
// Derives risk indicators from real Supabase data only.
// =====================================================
router.get("/counterparty-risk", requireAuth, async (req, res) => {
  try {
    // Verify the requesting user is fully verified
    const callerId = req.operator.sub || req.operator.userId || req.operator.id;
    const { data: caller } = await supabase
      .from("users")
      .select("email_verified, phone_verified")
      .eq("id", callerId)
      .single();

    if (!caller?.email_verified || !caller?.phone_verified) {
      return res.status(403).json({
        success: false,
        error: "Full verification (email + phone) required to access counterparty risk data.",
      });
    }

    // 1. Fetch all fully verified participants
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, full_name, organization, roles, stellar_public_key, country, city, email_verified, phone_verified, created_at")
      .eq("email_verified", true)
      .eq("phone_verified", true)
      .order("full_name", { ascending: true });

    if (usersErr) throw usersErr;

    // 2. Fetch all settlements to compute per-participant metrics
    let allSettlements = [];
    try {
      const { data } = await supabase
        .from("settlements")
        .select("id, seller, buyer, status, amount_brl, volume_mwh, created_at");
      allSettlements = data || [];
    } catch { /* table may not exist */ }

    // 3. Fetch active contracts
    let allContracts = [];
    try {
      const { data } = await supabase
        .from("contracts")
        .select("id, seller_id, buyer_id, status");
      allContracts = data || [];
    } catch { /* table may not exist */ }

    // 4. Build per-participant settlement map
    const settlementMap = {};
    for (const s of allSettlements) {
      for (const key of [s.seller, s.buyer]) {
        if (!key) continue;
        if (!settlementMap[key]) settlementMap[key] = { settled: 0, failed: 0, total: 0, volume_brl: 0 };
        settlementMap[key].total += 1;
        if (s.status === "SETTLED" || s.status === "CONFIRMED") {
          settlementMap[key].settled += 1;
          settlementMap[key].volume_brl += Number(s.amount_brl || 0);
        }
        if (s.status === "FAILED") settlementMap[key].failed += 1;
      }
    }

    // 5. Build per-participant contract map
    const contractMap = {};
    for (const c of allContracts) {
      for (const key of [c.seller_id, c.buyer_id]) {
        if (!key) continue;
        if (!contractMap[key]) contractMap[key] = { active: 0, total: 0 };
        contractMap[key].total += 1;
        if (c.status === "ACTIVE") contractMap[key].active += 1;
      }
    }

    // 6. Check Stellar wallet funding status (batch — use public keys)
    const walletStatus = {};
    const publicKeys = (users || []).map((u) => u.stellar_public_key).filter(Boolean);
    for (const pk of publicKeys) {
      try {
        const account = await horizon.loadAccount(pk);
        const xlm = account.balances.find((b) => b.asset_type === "native");
        const epwr = account.balances.find((b) => b.asset_code === "EPWR");
        walletStatus[pk] = {
          funded: true,
          xlm_balance: xlm ? parseFloat(xlm.balance) : 0,
          has_trustline: !!epwr,
        };
      } catch {
        walletStatus[pk] = { funded: false, xlm_balance: 0, has_trustline: false };
      }
    }

    // 7. Build risk profiles
    const profiles = (users || []).map((u) => {
      const pk = u.stellar_public_key;
      const sMap = settlementMap[pk] || settlementMap[u.id] || { settled: 0, failed: 0, total: 0, volume_brl: 0 };
      const cMap = contractMap[u.id] || { active: 0, total: 0 };
      const wallet = walletStatus[pk] || { funded: false, xlm_balance: 0, has_trustline: false };

      const reliability = sMap.total > 0
        ? Math.round((sMap.settled / sMap.total) * 10000) / 100
        : null;

      // Clearing eligibility: verified + funded wallet + trustline
      const clearingEligible = wallet.funded && wallet.has_trustline;

      return {
        id: u.id,
        full_name: u.full_name,
        organization: u.organization,
        roles: u.roles,
        country: u.country,
        city: u.city,
        stellar_public_key: pk || null,
        verified: true, // only verified users are returned
        member_since: u.created_at,
        // Settlement metrics (real)
        settlements_total: sMap.total,
        settlements_settled: sMap.settled,
        settlements_failed: sMap.failed,
        settlement_reliability_pct: reliability,
        cleared_volume_brl: sMap.volume_brl,
        // Contract metrics (real)
        active_contracts: cMap.active,
        total_contracts: cMap.total,
        // Wallet status (real — from Horizon)
        wallet_funded: wallet.funded,
        has_trustline: wallet.has_trustline,
        clearing_eligible: clearingEligible,
        // Not available — no risk engine
        collateral_coverage: null,
        risk_tier: null,
        credit_score: null,
      };
    });

    res.json({
      success: true,
      participants: profiles,
      total: profiles.length,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Counterparty risk error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
