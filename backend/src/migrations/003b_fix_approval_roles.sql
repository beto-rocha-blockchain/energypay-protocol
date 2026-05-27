-- ============================================================
-- 003b_fix_approval_roles.sql
-- Patch for contract_approvals table created by 003.
--
-- If you ALREADY ran 003_approvals_notifications.sql, run this
-- patch in Supabase SQL Editor to update the constraints.
--
-- If you haven't run 003 yet, just run the updated 003 instead
-- (it already includes these fixes — skip this file).
-- ============================================================

-- 1. Widen the party_role check to include all multi-party roles
ALTER TABLE contract_approvals
  DROP CONSTRAINT IF EXISTS contract_approvals_party_role_check;

ALTER TABLE contract_approvals
  ADD CONSTRAINT contract_approvals_party_role_check
  CHECK (party_role IN ('BUYER', 'SELLER', 'GUARANTOR', 'BROKER', 'WITNESS'));

-- 2. Replace the per-role unique constraint with a per-public-key one
--    Old: UNIQUE(contract_id, party_role) — blocks two sellers on same contract
--    New: UNIQUE(contract_id, party_public_key) — one row per wallet address
ALTER TABLE contract_approvals
  DROP CONSTRAINT IF EXISTS contract_approvals_contract_id_party_role_key;

ALTER TABLE contract_approvals
  ADD CONSTRAINT contract_approvals_contract_id_party_public_key_key
  UNIQUE (contract_id, party_public_key);
