-- ============================================================
-- Migration 001: Email + Phone verification + GPS coordinates
-- EnergyPay Protocol · Mainnet preparation
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Adds:
--   • email_verified             — boolean, default false
--   • email_verification_token   — unique token for verify-email link
--   • phone_verified             — boolean, default false
--   • coords                     — JSONB { lat, lng, source }
--
-- Visibility rule: users are ONLY visible to other participants
-- (counterparties, grid, P2P) when BOTH email_verified = true
-- AND phone_verified = true.
-- ============================================================

-- 1. Add columns (idempotent — safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coords jsonb;

-- 2. Index for fast token lookup during verification
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

-- 3. Index for fully verified users (visible to the platform)
CREATE INDEX IF NOT EXISTS idx_users_fully_verified
  ON users (email_verified, phone_verified)
  WHERE email_verified = true AND phone_verified = true;

-- 4. Index for grid-participants query (verified + has coords)
CREATE INDEX IF NOT EXISTS idx_users_verified_with_coords
  ON users (email_verified, phone_verified)
  WHERE email_verified = true AND phone_verified = true AND coords IS NOT NULL;

-- ============================================================
-- ALL users (existing and new) must verify BOTH email and phone
-- before appearing on any platform list. No auto-verification.
-- ============================================================
