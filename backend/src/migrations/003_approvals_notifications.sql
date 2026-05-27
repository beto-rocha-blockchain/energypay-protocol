-- ============================================================
-- 003_approvals_notifications.sql
-- Bilateral contract approval + in-platform notification inbox
-- Run in: Supabase SQL editor (Dashboard → SQL Editor → Run)
-- ============================================================

-- Contract approval records — one per party per contract
CREATE TABLE IF NOT EXISTS contract_approvals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  party_role      TEXT        NOT NULL CHECK (party_role IN ('BUYER', 'SELLER', 'GUARANTOR', 'BROKER', 'WITNESS')),
  party_user_id   UUID,                         -- NULL if counterparty has no platform account
  party_public_key TEXT       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- unique per contract + public key (one approval row per wallet address, not per role)
  UNIQUE(contract_id, party_public_key)
);

-- In-platform notification inbox
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  contract_id  UUID        REFERENCES contracts(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,   -- APPROVAL_REQUIRED | APPROVED | REJECTED | SETTLED | INFO
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  action_label TEXT,                   -- e.g. "Review Contract"
  action_url   TEXT,                   -- e.g. "/contracts"
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_approvals_contract
  ON contract_approvals(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_approvals_user
  ON contract_approvals(party_user_id);

CREATE INDEX IF NOT EXISTS idx_contract_approvals_pubkey
  ON contract_approvals(party_public_key);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_contract
  ON notifications(contract_id);
