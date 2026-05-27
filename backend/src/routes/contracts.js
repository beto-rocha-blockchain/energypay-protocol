/**
 * /api/contracts — Full contract lifecycle
 *
 * DRAFT → ACTIVE → PENDING_SIGNATURE → BROADCASTING → SETTLED | FAILED
 *
 * Every state transition appends an immutable row to contract_movements.
 * Settlement execution requires { confirmed: true } to prevent accidental
 * mainnet transactions.
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import {
  atomicTokenizeContract,
  getDistributionAddress,
  createTrustlineForSecret,
  getEPWRAssetInfo,
} from "../services/tokenService.js";
import { horizon } from "../lib/stellar-network.js";

const router = express.Router();

// -----------------------------------------------
// Helpers
// -----------------------------------------------

/** Insert an in-platform notification. Never throws — non-fatal. */
async function addNotification(userId, { contractId, type, title, message, actionLabel, actionUrl }) {
  if (!userId) return;
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      contract_id: contractId ?? null,
      type,
      title,
      message,
      action_label: actionLabel ?? null,
      action_url: actionUrl ?? null,
    });
  } catch (err) {
    console.warn("addNotification non-fatal:", err.message);
  }
}

/** Append an immutable movement row. Never throws — non-fatal. */
async function addMovement(contractId, { fromState, toState, actorUserId, notes, txHash, ledger }) {
  try {
    await supabase.from("contract_movements").insert({
      contract_id: contractId,
      from_state: fromState ?? null,
      to_state: toState,
      actor_user_id: actorUserId ?? null,
      notes: notes ?? null,
      tx_hash: txHash ?? null,
      ledger: ledger ?? null,
    });
  } catch (err) {
    console.warn("addMovement non-fatal error:", err.message);
  }
}

/** Resolve Supabase user id from a Stellar public key. */
async function userIdFromPublicKey(publicKey) {
  if (!publicKey) return null;
  try {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("stellar_public_key", publicKey)
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// GET /api/contracts
// List contracts for the authenticated operator.
// SELLER / INVESTOR see all. Others see their own.
// -----------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const roles = Array.isArray(req.operator.roles)
      ? req.operator.roles.map((r) => String(r).toUpperCase())
      : [];
    const isBroker = roles.some((r) => ["SELLER", "INVESTOR"].includes(r));

    let query = supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isBroker) {
      // scope to contracts where this user is buyer or seller
      query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId},created_by.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, contracts: data ?? [] });
  } catch (err) {
    console.error("GET /api/contracts error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// GET /api/contracts/:id
// Full detail including movements and instructions.
// -----------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }

    const [{ data: movements }, { data: instructions }] = await Promise.all([
      supabase
        .from("contract_movements")
        .select("*")
        .eq("contract_id", req.params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("settlement_instructions")
        .select("*")
        .eq("contract_id", req.params.id)
        .order("created_at", { ascending: false }),
    ]);

    return res.json({
      success: true,
      contract: {
        ...contract,
        movements: movements ?? [],
        instructions: instructions ?? [],
      },
    });
  } catch (err) {
    console.error("GET /api/contracts/:id error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts
// Create a new contract in DRAFT/CREATED state.
// Does NOT execute any Stellar transaction.
// If tx_hash is provided, contract is SETTLED.
// -----------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const {
      contract_number,
      buyer_public_key,
      seller_public_key,
      buyer_label,
      seller_label,
      volume_mwh,
      price_brl,
      pld_brl,
      start_date,
      end_date,
      settlement_date,
      memo,
      // if provided, contract is already settled via atomic-tokenize
      tx_hash,
      ledger,
      finality_ms,
      // optional: full list of contract parties [{publicKey, userId, role, label}]
      // roles: BUYER | SELLER | GUARANTOR | BROKER | WITNESS
      parties: partiesList,
    } = req.body;

    if (!buyer_public_key || !volume_mwh || !price_brl) {
      return res.status(422).json({
        success: false,
        error: "buyer_public_key, volume_mwh and price_brl are required.",
      });
    }

    const alreadySettled = !!tx_hash;

    // Resolve creator's public key to validate they are a contract party
    const { data: creatorRow } = await supabase
      .from("users")
      .select("stellar_public_key")
      .eq("id", userId)
      .single();
    const creatorPK = creatorRow?.stellar_public_key ?? null;

    // Collect all seller keys (primary + extras from partiesList)
    const sellerPKs = [
      seller_public_key,
      ...(Array.isArray(partiesList)
        ? partiesList
            .filter((p) => ["SELLER", "GUARANTOR", "BROKER"].includes(p.role ?? "SELLER"))
            .map((p) => p.publicKey)
        : []),
    ].filter(Boolean);

    const isCreatorBuyer = creatorPK && buyer_public_key && creatorPK === buyer_public_key;
    const isCreatorSeller = creatorPK && sellerPKs.includes(creatorPK);

    if (!alreadySettled && !isCreatorBuyer && !isCreatorSeller) {
      return res.status(403).json({
        success: false,
        error:
          "You must be the buyer or a seller of this contract to register it. " +
          "You cannot create contracts on behalf of unrelated parties.",
        code: "NOT_A_CONTRACT_PARTY",
      });
    }

    // Resolve user ids from public keys
    const [buyerId, sellerId] = await Promise.all([
      userIdFromPublicKey(buyer_public_key) ?? userId,
      userIdFromPublicKey(seller_public_key),
    ]);

    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        contract_number: contract_number ?? null,
        buyer_id: buyerId ?? userId,
        seller_id: sellerId ?? null,
        buyer_public_key,
        seller_public_key: seller_public_key ?? null,
        buyer_label: buyer_label ?? null,
        seller_label: seller_label ?? null,
        volume_mwh: Number(volume_mwh),
        price_brl: Number(price_brl),
        pld_brl: pld_brl != null ? Number(pld_brl) : Number(price_brl),
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        settlement_date: settlement_date ?? null,
        status: alreadySettled ? "SETTLED" : "DRAFT",
        state: alreadySettled ? "SETTLED" : "CREATED",
        tx_hash: tx_hash ?? null,
        ledger: ledger ?? null,
        finality_ms: finality_ms ?? null,
        memo: memo ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // First movement
    await addMovement(contract.id, {
      fromState: null,
      toState: alreadySettled ? "SETTLED" : "CREATED",
      actorUserId: userId,
      notes: alreadySettled
        ? `Contract registered and settled on-chain. Tx: ${tx_hash?.slice(0, 12)}…`
        : `Contract registered: ${contract_number || contract.id}`,
      txHash: tx_hash ?? null,
      ledger: ledger ?? null,
    });

    // ── Approval workflow for DRAFT contracts ──────────────────────────
    // When atomicExecution=false, the contract starts as DRAFT and requires
    // multilateral approval before settlement can be executed on-chain.
    if (!alreadySettled && buyer_public_key) {
      const contractRef = contract_number || contract.id.slice(0, 8).toUpperCase();
      const volLabel = `${Number(volume_mwh).toFixed(0)} MWh @ R$ ${Number(price_brl).toFixed(2)}/MWh`;

      // Build the full parties list.
      // The CREATOR is always auto-approved (they initiated the contract).
      // All counterparties require explicit approval.
      const allParties = [];

      // Buyer entry
      allParties.push({
        publicKey: buyer_public_key,
        userId: buyerId ?? userId,
        role: "BUYER",
        label: buyer_label || null,
        // Auto-approve only if the creator is the buyer
        autoApprove: isCreatorBuyer,
      });

      if (Array.isArray(partiesList) && partiesList.length > 0) {
        for (const p of partiesList) {
          if (!p.publicKey || p.publicKey === buyer_public_key) continue;
          const pUserId = p.userId ?? await userIdFromPublicKey(p.publicKey);
          allParties.push({
            publicKey: p.publicKey,
            userId: pUserId,
            role: p.role || "SELLER",
            label: p.label || null,
            // Auto-approve if this party is the creator
            autoApprove: creatorPK ? p.publicKey === creatorPK : false,
          });
        }
      } else if (seller_public_key) {
        // Legacy: single seller fallback
        allParties.push({
          publicKey: seller_public_key,
          userId: sellerId ?? null,
          role: "SELLER",
          label: seller_label || null,
          autoApprove: isCreatorSeller,
        });
      }

      // Insert approval records for all parties
      for (const party of allParties) {
        const { error: approvalErr } = await supabase.from("contract_approvals").insert({
          contract_id: contract.id,
          party_role: party.role,
          party_user_id: party.userId ?? null,
          party_public_key: party.publicKey,
          status: party.autoApprove ? "APPROVED" : "PENDING",
          approved_at: party.autoApprove ? new Date().toISOString() : null,
        });
        if (approvalErr) console.warn("contract_approvals insert non-fatal:", approvalErr.message);

        if (!party.autoApprove && party.userId) {
          await addNotification(party.userId, {
            contractId: contract.id,
            type: "APPROVAL_REQUIRED",
            title: "Contract approval required",
            message: `You have been added as ${party.role} in contract ${contractRef} · ${volLabel}. Your approval is required before settlement.`,
            actionLabel: "Review Contract",
            actionUrl: "/contracts",
          });
        }
      }

      // Notify the creator that they are waiting for counterparty approvals
      const pendingCount = allParties.filter((p) => !p.autoApprove).length;
      if (pendingCount > 0) {
        const creatorNotifyId = isCreatorBuyer
          ? (buyerId ?? userId)
          : (allParties.find((p) => p.autoApprove)?.userId ?? userId);
        await addNotification(creatorNotifyId, {
          contractId: contract.id,
          type: "INFO",
          title: "Awaiting counterparty approvals",
          message:
            `Contract ${contractRef} submitted. ` +
            `Waiting for ${pendingCount} counterpart${pendingCount > 1 ? "ies" : "y"} to approve. ` +
            `The Stellar transaction will execute automatically once all parties confirm.`,
          actionLabel: "View Contract",
          actionUrl: "/contracts",
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────

    return res.status(201).json({ success: true, contract });
  } catch (err) {
    console.error("POST /api/contracts error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts/:id/activate
// DRAFT → ACTIVE   (state: CREATED → VALIDATED)
// -----------------------------------------------
router.post("/:id/activate", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("id, status, state")
      .eq("id", req.params.id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }
    if (contract.status !== "DRAFT") {
      return res.status(409).json({
        success: false,
        error: `Cannot activate contract with status "${contract.status}".`,
      });
    }

    const { data: updated, error: upErr } = await supabase
      .from("contracts")
      .update({ status: "ACTIVE", state: "VALIDATED" })
      .eq("id", req.params.id)
      .select()
      .single();

    if (upErr) throw upErr;

    await addMovement(req.params.id, {
      fromState: "CREATED",
      toState: "VALIDATED",
      actorUserId: userId,
      notes: "Contract activated and validated.",
    });

    return res.json({ success: true, contract: updated });
  } catch (err) {
    console.error("POST /api/contracts/:id/activate error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts/:id/request-settlement
// ACTIVE → PENDING   (state → PENDING_SIGNATURE)
// Creates a settlement_instruction record.
// -----------------------------------------------
router.post("/:id/request-settlement", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }
    if (!["ACTIVE", "DRAFT"].includes(contract.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot request settlement for contract with status "${contract.status}".`,
      });
    }

    // Create settlement instruction with idempotency key
    const idempotencyKey = `settle-${req.params.id}`;
    const { data: existingInstr } = await supabase
      .from("settlement_instructions")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .single();

    let instrId;
    if (!existingInstr) {
      const { data: instr } = await supabase
        .from("settlement_instructions")
        .insert({
          contract_id: req.params.id,
          instruction_type: "DIRECT_SETTLEMENT",
          status: "PENDING",
          idempotency_key: idempotencyKey,
          payload: {
            volume_mwh: contract.volume_mwh,
            price_brl: contract.price_brl,
            buyer_public_key: contract.buyer_public_key,
            seller_public_key: contract.seller_public_key,
          },
        })
        .select("id")
        .single();
      instrId = instr?.id;
    } else {
      instrId = existingInstr.id;
    }

    const { data: updated, error: upErr } = await supabase
      .from("contracts")
      .update({ status: "PENDING", state: "PENDING_SIGNATURE" })
      .eq("id", req.params.id)
      .select()
      .single();

    if (upErr) throw upErr;

    await addMovement(req.params.id, {
      fromState: contract.state,
      toState: "PENDING_SIGNATURE",
      actorUserId: userId,
      notes: "Settlement requested. Awaiting execution.",
    });

    return res.json({
      success: true,
      contract: updated,
      instruction_id: instrId,
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    console.error("POST /api/contracts/:id/request-settlement error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts/:id/execute-settlement
// Executes the Stellar transaction.
// REQUIRES { confirmed: true } in body — no accidental mainnet txs.
// Idempotent: returns existing result if already settled.
// -----------------------------------------------
router.post("/:id/execute-settlement", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const { confirmed, idempotency_key } = req.body ?? {};

    if (!confirmed) {
      return res.status(422).json({
        success: false,
        error:
          "Executing a Stellar settlement requires explicit confirmation. Send { confirmed: true }.",
        code: "CONFIRMATION_REQUIRED",
      });
    }

    const { data: contract, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }

    // Idempotency — don't re-execute an already settled contract
    if (contract.tx_hash && contract.tx_hash.length > 8 && contract.status === "SETTLED") {
      return res.status(409).json({
        success: false,
        error: "Settlement already executed.",
        code: "ALREADY_SETTLED",
        tx_hash: contract.tx_hash,
        ledger: contract.ledger,
      });
    }

    // Check settlement instruction for prior completion
    const iKey = idempotency_key || `settle-${req.params.id}`;
    const { data: instrCheck } = await supabase
      .from("settlement_instructions")
      .select("id, status, tx_hash, ledger")
      .eq("idempotency_key", iKey)
      .single();

    if (instrCheck?.status === "COMPLETED") {
      return res.json({
        success: true,
        idempotent_replay: true,
        tx_hash: instrCheck.tx_hash,
        ledger: instrCheck.ledger,
        message: "Settlement already executed (idempotent replay).",
      });
    }

    // Transition to BROADCASTING
    await supabase
      .from("contracts")
      .update({ state: "BROADCASTING" })
      .eq("id", req.params.id);

    await addMovement(req.params.id, {
      fromState: contract.state,
      toState: "BROADCASTING",
      actorUserId: userId,
      notes: "Settlement execution initiated — broadcasting to Stellar.",
    });

    // Mark instruction as EXECUTING
    if (instrCheck) {
      await supabase
        .from("settlement_instructions")
        .update({ status: "EXECUTING" })
        .eq("id", instrCheck.id);
    }

    // ── STELLAR TX ──
    const t0 = Date.now();
    const result = await atomicTokenizeContract({
      buyerPublicKey: contract.buyer_public_key,
      sellerPublicKey: contract.seller_public_key || getDistributionAddress(),
      volumeMWh: Number(contract.volume_mwh),
      priceBRL: Number(contract.price_brl),
      contractNumber: contract.contract_number || contract.id,
      startDate: contract.start_date,
      endDate: contract.end_date,
      settlementDate: contract.settlement_date,
      memo: contract.memo || `EP:${contract.id.slice(0, 24)}`,
    });
    const finalityMs = Date.now() - t0;

    if (!result.success) {
      // Transition to FAILED
      await supabase
        .from("contracts")
        .update({ state: "FAILED", status: "FAILED" })
        .eq("id", req.params.id);

      await addMovement(req.params.id, {
        fromState: "BROADCASTING",
        toState: "FAILED",
        actorUserId: userId,
        notes: `Settlement failed: ${result.error}`,
      });

      if (instrCheck) {
        await supabase
          .from("settlement_instructions")
          .update({
            status: "FAILED",
            error_msg: result.error,
            executed_at: new Date().toISOString(),
          })
          .eq("id", instrCheck.id);
      }

      return res.status(400).json({
        success: false,
        error: result.error,
        code: "STELLAR_TX_FAILED",
      });
    }

    // ── SUCCESS ── persist tx_hash, ledger, status=SETTLED
    const { data: settled, error: upErr } = await supabase
      .from("contracts")
      .update({
        status: "SETTLED",
        state: "SETTLED",
        tx_hash: result.hash,
        ledger: result.ledger,
        finality_ms: finalityMs,
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (upErr) throw upErr;

    await addMovement(req.params.id, {
      fromState: "BROADCASTING",
      toState: "SETTLED",
      actorUserId: userId,
      notes: `Settlement finalized on Stellar. Ledger #${result.ledger}`,
      txHash: result.hash,
      ledger: result.ledger,
    });

    // Mark instruction as COMPLETED
    if (instrCheck) {
      await supabase
        .from("settlement_instructions")
        .update({
          status: "COMPLETED",
          tx_hash: result.hash,
          ledger: result.ledger,
          finality_ms: finalityMs,
          executed_at: new Date().toISOString(),
        })
        .eq("id", instrCheck.id);
    }

    // Persist to settlements table for reconciliation/audit feed
    await supabase
      .from("settlements")
      .insert({
        settlement_id: `CNT-${contract.id.slice(0, 8)}`,
        contract_id: contract.id,
        buyer: contract.buyer_public_key || contract.buyer_label || "—",
        seller: contract.seller_public_key || contract.seller_label || "—",
        amount_brl: Number(contract.volume_mwh) * Number(contract.price_brl),
        volume_mwh: Number(contract.volume_mwh),
        pld: Number(contract.pld_brl || contract.price_brl),
        tx_hash: result.hash,
        ledger: result.ledger,
        finality_ms: finalityMs,
        status: "SETTLED",
      })
      .catch((err) => console.warn("settlements insert non-fatal:", err.message));

    return res.json({
      success: true,
      contract: settled,
      tx_hash: result.hash,
      ledger: result.ledger,
      finality_ms: finalityMs,
      explorer_url: result.explorer_url,
    });
  } catch (err) {
    console.error("POST /api/contracts/:id/execute-settlement error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// GET /api/contracts/:id/approvals
// Returns the bilateral approval status for a contract.
// -----------------------------------------------
router.get("/:id/approvals", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", req.params.id)
      .order("party_role", { ascending: true });

    if (error) throw error;
    return res.json({ success: true, approvals: data ?? [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts/:id/approve
// The authenticated user approves the contract.
// When all parties have approved → auto-activates DRAFT.
// -----------------------------------------------
router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;

    // Get the user's stellar public key
    const { data: userRow } = await supabase
      .from("users")
      .select("stellar_public_key, display_name, email")
      .eq("id", userId)
      .single();

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (cErr || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }

    if (!["DRAFT"].includes(contract.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot approve a contract with status "${contract.status}".`,
      });
    }

    // Find the approval record for this user (by user_id or public_key)
    const { data: approvals } = await supabase
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", req.params.id);

    const myApproval = (approvals ?? []).find(
      (a) =>
        a.party_user_id === userId ||
        (userRow?.stellar_public_key && a.party_public_key === userRow.stellar_public_key),
    );

    if (!myApproval) {
      return res.status(403).json({
        success: false,
        error: "You are not a party to this contract.",
      });
    }

    if (myApproval.status === "APPROVED") {
      return res.json({ success: true, message: "Already approved.", already: true });
    }

    // Mark as APPROVED
    await supabase
      .from("contract_approvals")
      .update({ status: "APPROVED", approved_at: new Date().toISOString() })
      .eq("id", myApproval.id);

    const contractRef = contract.contract_number || contract.id.slice(0, 8).toUpperCase();
    const approverLabel = userRow?.display_name || userRow?.email || userId;

    // Notify all other parties
    const otherApprovals = (approvals ?? []).filter((a) => a.id !== myApproval.id);
    for (const other of otherApprovals) {
      if (other.party_user_id) {
        await addNotification(other.party_user_id, {
          contractId: contract.id,
          type: "APPROVED",
          title: "Contract approved by counterparty",
          message: `${approverLabel} approved contract ${contractRef}.`,
          actionLabel: "View Contract",
          actionUrl: "/contracts",
        });
      }
    }

    // Check if ALL parties approved → auto-activate
    const { data: freshApprovals } = await supabase
      .from("contract_approvals")
      .select("status")
      .eq("contract_id", req.params.id);

    const allApproved = (freshApprovals ?? []).length > 0 &&
      (freshApprovals ?? []).every((a) => a.status === "APPROVED");

    let activated = false;
    let atomicSettled = false;

    if (allApproved && contract.status === "DRAFT") {
      // ── All parties approved → execute atomic Stellar tokenization ──────
      // 1. Auto-provision EPWR trustline for buyer if missing
      try {
        const issuerPK = getEPWRAssetInfo().issuer;
        const buyerAccount = await horizon
          .loadAccount(contract.buyer_public_key)
          .catch(() => null);
        const hasTrustline = buyerAccount?.balances?.some(
          (b) => b.asset_code === "EPWR" && b.asset_issuer === issuerPK,
        );
        if (!hasTrustline) {
          const { data: buyerRec } = await supabase
            .from("users")
            .select("stellar_secret_encrypted")
            .eq("stellar_public_key", contract.buyer_public_key)
            .single();
          if (buyerRec?.stellar_secret_encrypted) {
            await createTrustlineForSecret(
              buyerRec.stellar_secret_encrypted,
              "buyer-auto-trustline-on-approve",
            );
            console.log(
              `[approve] Auto-created EPWR trustline for buyer ${contract.buyer_public_key}`,
            );
          }
        }
      } catch (tlErr) {
        console.warn("[approve] Trustline pre-check non-fatal:", tlErr.message);
      }

      // 2. Execute the atomic Stellar transaction
      const t0 = Date.now();
      const atomicResult = await atomicTokenizeContract({
        buyerPublicKey: contract.buyer_public_key,
        sellerPublicKey: contract.seller_public_key || getDistributionAddress(),
        volumeMWh: contract.volume_mwh,
        priceBRL: contract.price_brl,
        contractNumber: contract.contract_number,
        startDate: contract.start_date,
        endDate: contract.end_date,
        settlementDate: contract.settlement_date,
        memo: contract.memo,
      });
      const finalityMs = Date.now() - t0;

      const allContractParties = approvals ?? [];

      if (atomicResult.success) {
        // 3a. Update contract → SETTLED
        await supabase
          .from("contracts")
          .update({
            status: "SETTLED",
            state: "SETTLED",
            tx_hash: atomicResult.hash,
            ledger: atomicResult.ledger,
            finality_ms: finalityMs,
          })
          .eq("id", contract.id);

        await addMovement(contract.id, {
          fromState: "CREATED",
          toState: "SETTLED",
          actorUserId: userId,
          notes: `All parties approved. Atomic tokenization confirmed. Ledger #${atomicResult.ledger}`,
          txHash: atomicResult.hash,
          ledger: atomicResult.ledger,
        });

        // Also persist settlement record for reconciliation feed (non-fatal)
        const { error: settlErr } = await supabase.from("settlements").insert({
          settlement_id: `CNT-${contract.id.slice(0, 8)}`,
          contract_id: contract.id,
          buyer: contract.buyer_public_key,
          seller: contract.seller_public_key || getDistributionAddress(),
          amount_brl: Number(contract.volume_mwh) * Number(contract.price_brl),
          volume_mwh: Number(contract.volume_mwh),
          pld: Number(contract.price_brl),
          tx_hash: atomicResult.hash,
          ledger: atomicResult.ledger,
          finality_ms: finalityMs,
          status: "SETTLED",
        });
        if (settlErr) console.warn("settlements insert non-fatal:", settlErr.message);

        activated = true;
        atomicSettled = true;

        // 3b. Notify all parties of settlement
        for (const party of allContractParties) {
          if (party.party_user_id) {
            await addNotification(party.party_user_id, {
              contractId: contract.id,
              type: "SETTLED",
              title: `Contract ${contractRef} settled on Stellar`,
              message:
                `All parties approved. The energy contract (${contract.volume_mwh} MWh @ ` +
                `R$${contract.price_brl}/MWh) was atomically tokenized on Stellar. ` +
                `Tx: ${atomicResult.hash?.slice(0, 12)}… · Ledger #${atomicResult.ledger}`,
              actionLabel: "View Contract",
              actionUrl: "/contracts",
            });
          }
        }
      } else {
        // 3c. Atomic tokenization failed → mark contract FAILED
        await supabase
          .from("contracts")
          .update({ status: "FAILED", state: "FAILED" })
          .eq("id", contract.id);

        await addMovement(contract.id, {
          fromState: "CREATED",
          toState: "FAILED",
          actorUserId: userId,
          notes: `Atomic tokenization failed after all approvals: ${atomicResult.error}`,
        });

        // Notify all parties of failure
        for (const party of allContractParties) {
          if (party.party_user_id) {
            await addNotification(party.party_user_id, {
              contractId: contract.id,
              type: "INFO",
              title: `Contract ${contractRef} — settlement failed`,
              message:
                `The atomic tokenization failed after all approvals: ${atomicResult.error}. ` +
                `Please contact support or retry from the Contract Registry.`,
              actionLabel: "View Contract",
              actionUrl: "/contracts",
            });
          }
        }
      }
    }

    return res.json({ success: true, approved: true, activated, atomic_settled: atomicSettled });
  } catch (err) {
    console.error("POST /api/contracts/:id/approve error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// POST /api/contracts/:id/reject
// The authenticated user rejects the contract.
// Contract moves to REJECTED — no Stellar tx executed.
// -----------------------------------------------
router.post("/:id/reject", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;
    const { reason } = req.body ?? {};

    const { data: userRow } = await supabase
      .from("users")
      .select("stellar_public_key, display_name, email")
      .eq("id", userId)
      .single();

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (cErr || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }

    if (contract.status !== "DRAFT") {
      return res.status(409).json({
        success: false,
        error: `Cannot reject a contract with status "${contract.status}".`,
      });
    }

    const { data: approvals } = await supabase
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", req.params.id);

    const myApproval = (approvals ?? []).find(
      (a) =>
        a.party_user_id === userId ||
        (userRow?.stellar_public_key && a.party_public_key === userRow.stellar_public_key),
    );

    if (!myApproval) {
      return res.status(403).json({
        success: false,
        error: "You are not a party to this contract.",
      });
    }

    // Mark approval as REJECTED
    await supabase
      .from("contract_approvals")
      .update({
        status: "REJECTED",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason ?? null,
      })
      .eq("id", myApproval.id);

    // Move contract to REJECTED
    await supabase
      .from("contracts")
      .update({ status: "FAILED", state: "FAILED" })
      .eq("id", req.params.id);

    const contractRef = contract.contract_number || contract.id.slice(0, 8).toUpperCase();
    const rejecterLabel = userRow?.display_name || userRow?.email || userId;

    await addMovement(req.params.id, {
      fromState: contract.state,
      toState: "FAILED",
      actorUserId: userId,
      notes: `Contract rejected by ${myApproval.party_role}${reason ? `: ${reason}` : ""}.`,
    });

    // Notify all other parties
    const otherApprovals = (approvals ?? []).filter((a) => a.id !== myApproval.id);
    for (const other of otherApprovals) {
      if (other.party_user_id) {
        await addNotification(other.party_user_id, {
          contractId: contract.id,
          type: "REJECTED",
          title: "Contract rejected",
          message: `${rejecterLabel} rejected contract ${contractRef}${reason ? ` — reason: ${reason}` : ""}.`,
          actionLabel: "View Contract",
          actionUrl: "/contracts",
        });
      }
    }

    return res.json({ success: true, rejected: true });
  } catch (err) {
    console.error("POST /api/contracts/:id/reject error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// GET /api/contracts/:id/movements
// Immutable audit trail for a single contract.
// -----------------------------------------------
router.get("/:id/movements", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contract_movements")
      .select("*")
      .eq("contract_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return res.json({ success: true, movements: data ?? [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------
// GET /api/contracts/:id/reconcile
// Compare internal DB record vs live Stellar Horizon.
// Requires SELLER or INVESTOR role.
// -----------------------------------------------
router.get("/:id/reconcile", requireAuth, async (req, res) => {
  try {
    const reconcilerRoles = Array.isArray(req.operator.roles)
      ? req.operator.roles.map((r) => String(r).toUpperCase())
      : [];
    const canReconcile = reconcilerRoles.some((r) => ["SELLER", "INVESTOR"].includes(r));
    if (!canReconcile) {
      return res.status(403).json({
        success: false,
        error: "Ledger reconciliation requires SELLER or INVESTOR role.",
        code: "INSUFFICIENT_ROLE",
      });
    }

    const { data: contract, error } = await supabase
      .from("contracts")
      .select("id, tx_hash, ledger, status, state, volume_mwh, price_brl")
      .eq("id", req.params.id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ success: false, error: "Contract not found." });
    }

    const rec = {
      contract_id: contract.id,
      internal_tx_hash: contract.tx_hash,
      internal_ledger: contract.ledger,
      internal_status: contract.status,
      horizon_verified: false,
      horizon_ledger: null,
      horizon_created_at: null,
      horizon_successful: null,
      discrepancy: null,
      checked_at: new Date().toISOString(),
    };

    if (!contract.tx_hash || contract.tx_hash.length < 32) {
      rec.discrepancy = "No tx_hash on record — settlement not yet executed.";
      return res.json({ success: true, reconciliation: rec });
    }

    try {
      const txRecord = await horizon.transactions().transaction(contract.tx_hash).call();
      rec.horizon_verified = txRecord.successful === true;
      // The Stellar SDK shadows `ledger` with a linked-resource function on TransactionRecord.
      // The actual sequence number is exposed as `ledger_attr` (number).
      rec.horizon_ledger = txRecord.ledger_attr;
      rec.horizon_created_at = txRecord.created_at;
      rec.horizon_successful = txRecord.successful;

      if (txRecord.ledger_attr !== contract.ledger) {
        rec.discrepancy = `Ledger mismatch: internal=${contract.ledger}, horizon=${txRecord.ledger_attr}`;
      } else if (!txRecord.successful) {
        rec.discrepancy = "Transaction on Horizon marked as not successful.";
      }
    } catch (horizonErr) {
      rec.horizon_error = horizonErr.message;
      rec.discrepancy = "Could not verify transaction on Horizon.";
    }

    return res.json({ success: true, reconciliation: rec });
  } catch (err) {
    console.error("GET /api/contracts/:id/reconcile error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
