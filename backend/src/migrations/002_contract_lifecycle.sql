-- ============================================================
-- Migration 002 — Contract Lifecycle Tables
-- ADDITIVE ONLY: never drops, truncates, or alters existing tables
-- ============================================================

-- -----------------------------------------------
-- contracts
-- Core contract record. Stores bilateral PPA
-- from DRAFT through SETTLED or FAILED.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number   TEXT,
  buyer_id          UUID        REFERENCES users(id),
  seller_id         UUID        REFERENCES users(id),
  buyer_public_key  TEXT        NOT NULL,
  seller_public_key TEXT,
  buyer_label       TEXT,
  seller_label      TEXT,
  volume_mwh        NUMERIC(18, 6) NOT NULL,
  price_brl         NUMERIC(18, 2) NOT NULL,
  pld_brl           NUMERIC(18, 2),
  start_date        DATE,
  end_date          DATE,
  settlement_date   DATE,
  status            TEXT        NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','ACTIVE','PENDING','SETTLED','FAILED')),
  state             TEXT        NOT NULL DEFAULT 'CREATED'
                      CHECK (state IN (
                        'CREATED','VALIDATED','PENDING_SIGNATURE',
                        'BROADCASTING','CONFIRMED','SETTLED','FAILED'
                      )),
  tx_hash           TEXT,
  ledger            BIGINT,
  finality_ms       INTEGER,
  settlement_window TEXT        NOT NULL DEFAULT 'D+1 17:00 BRT',
  memo              TEXT,
  created_by        UUID        REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- contract_movements
-- Immutable audit trail. One row per state transition.
-- Never updated — append-only.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS contract_movements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  from_state    TEXT,
  to_state      TEXT        NOT NULL,
  actor_user_id UUID        REFERENCES users(id),
  notes         TEXT,
  tx_hash       TEXT,
  ledger        BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- settlement_instructions
-- One instruction per settlement attempt.
-- idempotency_key prevents double-execution.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS settlement_instructions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  instruction_type TEXT        NOT NULL
                     CHECK (instruction_type IN (
                       'TOKEN_ISSUANCE','SETTLEMENT_LOCK',
                       'LEDGER_ANCHOR','DIRECT_SETTLEMENT'
                     )),
  status           TEXT        NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','EXECUTING','COMPLETED','FAILED')),
  tx_hash          TEXT,
  ledger           BIGINT,
  finality_ms      INTEGER,
  error_msg        TEXT,
  idempotency_key  TEXT        UNIQUE,
  payload          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at      TIMESTAMPTZ
);

-- -----------------------------------------------
-- Auto-update updated_at on contracts
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();
