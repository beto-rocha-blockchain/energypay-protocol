import express from "express";
import bcrypt from "bcrypt";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { Keypair, Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";

import { supabase } from "../lib/supabase.js";
import {
  FRIENDBOT_URL,
  FRIENDBOT_AVAILABLE,
  NETWORK_LABEL,
  NETWORK_PASSPHRASE,
  horizon,
} from "../lib/stellar-network.js";
import { Asset } from "@stellar/stellar-sdk";
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from "../services/emailService.js";
import { sendWhatsAppVerificationCode } from "../services/whatsappService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// In-memory store for password reset tokens (keyed by token → { userId, email, expiresAt })
// Fine for demo/hackathon; replace with DB table for production.
const resetTokens = new Map();

// In-memory store for reset phone-OTP confirmation
// Keyed by reset token → { userId, hashedPassword, code, expiresAt }
// Password is stored hashed until the OTP confirms the reset.
const resetPhoneCodes = new Map();

// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,
      phone,
      roles,
      country,
      city,
      address,
      organization,
      has_solar_generation,
      coords,
      wallet_mode,
      existing_public_key,
      existing_secret,
      energy_type,
    } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, error: "missing required fields" });
    }

    // Phone is mandatory — required for 2FA on sensitive operations (password reset, etc.)
    if (!phone || String(phone).replace(/[^\d]/g, "").length < 8) {
      return res.status(400).json({
        success: false,
        error: "A valid phone number is required for account security. Include country code (e.g. +55 11 99999-9999).",
      });
    }

    if (!roles || !roles.length) {
      return res.status(400).json({ success: false, error: "at least one role is required" });
    }

    const ALLOWED_ROLES = ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"];

    if (!Array.isArray(roles)) {
      return res.status(400).json({ success: false, error: "roles must be an array" });
    }

    const invalidRoles = roles.filter((r) => !ALLOWED_ROLES.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ success: false, error: `invalid roles: ${invalidRoles.join(", ")}` });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, error: "email already registered" });
    }

    // ── Keypair resolution ───────────────────────────────────────────────────
    let pair, publicKey, secretKey;

    if (wallet_mode === "link" && existing_public_key && existing_secret) {
      // Validate provided keypair: secret must derive to the given public key
      try {
        const provided = Keypair.fromSecret(existing_secret);
        if (provided.publicKey() !== existing_public_key) {
          return res.status(400).json({
            success: false,
            error: "The provided secret key does not match the provided public key.",
            code: "WALLET_KEY_MISMATCH",
          });
        }
        pair = provided;
        publicKey = existing_public_key;
        secretKey = existing_secret;
        console.log(`[Register] Linking existing wallet: ${publicKey}`);
      } catch (keyErr) {
        return res.status(400).json({
          success: false,
          error: "Invalid Stellar key format. Verify your public key (G…) and secret key (S…).",
          code: "WALLET_INVALID_KEY",
        });
      }
    } else {
      // Default: generate a fresh keypair
      pair = Keypair.random();
      publicKey = pair.publicKey();
      secretKey = pair.secret();
    }

    // ── Account funding ──────────────────────────────────────────────────────
    let stellarFunded = false;

    // For linked wallets: check whether the account already exists on-chain.
    // If it does, skip funding entirely — we don't want to waste operator XLM.
    if (wallet_mode === "link") {
      try {
        await horizon.loadAccount(publicKey);
        stellarFunded = true;
        console.log(`[Register] Linked wallet ${publicKey} already on-chain — skipping funding.`);
      } catch {
        console.log(`[Register] Linked wallet ${publicKey} not found on-chain — will attempt funding.`);
      }
    }

    if (!stellarFunded) {
      if (FRIENDBOT_AVAILABLE) {
        // Testnet: use Friendbot for free funding
        try {
          await axios.get(`${FRIENDBOT_URL}?addr=${publicKey}`, { timeout: 15000 });
          stellarFunded = true;
        } catch (friendbotError) {
          console.warn("Friendbot unavailable (non-fatal):", friendbotError.message);
        }
      } else {
        // Mainnet: fund new account from Operator with minimum XLM (2.5 XLM)
        const operatorSecret = (process.env.OPERATOR_SECRET || process.env.STELLAR_SECRET || "").trim();
        if (operatorSecret) {
          try {
            const operatorKeypair = Keypair.fromSecret(operatorSecret);
            const operatorAccount = await horizon.loadAccount(operatorKeypair.publicKey());

            const tx = new TransactionBuilder(operatorAccount, {
              fee: BASE_FEE,
              networkPassphrase: NETWORK_PASSPHRASE,
            })
              .addOperation(
                Operation.createAccount({
                  destination: publicKey,
                  startingBalance: "2.5", // Minimum for account + trustlines
                }),
              )
              .setTimeout(30)
              .build();

            tx.sign(operatorKeypair);
            await horizon.submitTransaction(tx);
            stellarFunded = true;
            console.log(`Mainnet: funded new account ${publicKey} with 2.5 XLM from Operator`);
          } catch (fundError) {
            console.warn("Mainnet funding failed (non-fatal):", fundError.message);
          }
        }
      }
    }

    // Auto-create EPWR trustline so the account can receive the token
    let epwrTrustline = false;
    if (stellarFunded) {
      try {
        const issuerPK = (process.env.EPWR_ISSUER_PUBLIC_KEY || "").trim();
        if (issuerPK) {
          const userKeypair = Keypair.fromSecret(secretKey);
          const userAccount = await horizon.loadAccount(publicKey);

          const trustTx = new TransactionBuilder(userAccount, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              Operation.changeTrust({
                asset: new Asset("EPWR", issuerPK),
              }),
            )
            .setTimeout(30)
            .build();

          trustTx.sign(userKeypair);
          await horizon.submitTransaction(trustTx);
          epwrTrustline = true;
          console.log(`EPWR trustline created for new account ${publicKey}`);
        }
      } catch (trustError) {
        console.warn("EPWR trustline creation failed (non-fatal):", trustError.message);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email-verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");

    const VALID_ENERGY_TYPES = ["SOLAR", "HYDRO", "SMALL_HYDRO", "WIND", "BIOMASS", "NATURAL_GAS", "NUCLEAR", "THERMAL", "COGENERATION", "GRID"];
    const resolvedEnergyType =
      roles?.includes("GENERATOR") && VALID_ENERGY_TYPES.includes(energy_type)
        ? energy_type
        : null;

    const baseInsert = {
      email,
      password: hashedPassword,
      full_name,
      organization,
      roles,
      stellar_public_key: publicKey,
      stellar_secret_encrypted: secretKey, // HACKATHON ONLY
      country,
      city,
      address,
      has_solar_generation,
      coords: coords ?? null,
      email_verified: false,
      email_verification_token: emailVerificationToken,
      phone_verified: false,
    };

    // Try with phone + energy_type; fall back gracefully if columns don't exist yet.
    let data, error;
    const withExtras = {
      ...baseInsert,
      ...(phone ? { phone } : {}),
      ...(resolvedEnergyType ? { energy_type: resolvedEnergyType } : {}),
    };

    ({ data, error } = await supabase.from("users").insert([withExtras]).select());

    if (error && (error.message?.includes("energy_type") || error.code === "42703")) {
      console.warn("[Auth] energy_type column not found — retrying without it.");
      const withoutEnergyType = { ...baseInsert, ...(phone ? { phone } : {}) };
      ({ data, error } = await supabase.from("users").insert([withoutEnergyType]).select());
    }

    if (error && (error.message?.includes("phone") || error.code === "42703")) {
      console.warn("[Auth] phone column not found — retrying without it.");
      ({ data, error } = await supabase.from("users").insert([baseInsert]).select());
    }

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const token = jwt.sign(
      {
        sub: data[0].id,
        email: data[0].email,
        roles: data[0].roles,
        phone: data[0].phone ?? phone ?? null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Send verification email (non-blocking — don't fail registration if email fails)
    let devVerifyUrl = null;
    try {
      const verifyResult = await sendVerificationEmail({
        to: email,
        fullName: full_name,
        verificationToken: emailVerificationToken,
      });
      if (verifyResult?.skipped && process.env.NODE_ENV !== "production") {
        const backendUrl = process.env.VITE_API_URL || process.env.BACKEND_URL || "http://localhost:3000";
        devVerifyUrl = `${backendUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
        console.log(`[Auth] DEV — verify email link for ${email}: ${devVerifyUrl}`);
      }
    } catch (e) {
      console.warn("[Auth] Verification email failed:", e.message);
    }

    res.json({
      success: true,
      token,
      ...(devVerifyUrl && { dev_verify_url: devVerifyUrl }),
      user: {
        id: data[0].id,
        email: data[0].email,
        full_name: data[0].full_name,
        phone: data[0].phone ?? phone ?? null,
        organization: data[0].organization,
        roles: data[0].roles,
        stellar_public_key: publicKey,
        country: data[0].country,
        city,
        address,
        has_solar_generation,
        coords: data[0].coords ?? coords ?? null,
        email_verified: false,
        phone_verified: false,
        phone: data[0].phone ?? phone ?? null,
      },
      provisioning: {
        wallet_created: true,
        stellar_funded: stellarFunded,
        epwr_trustline: epwrTrustline,
        settlement_ready: stellarFunded && epwrTrustline,
        roles_assigned: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.from("users").select("*").eq("email", email).single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: "invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, data.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: "invalid credentials" });
    }

    const token = jwt.sign(
      {
        sub: data.id,
        id: data.id,
        email: data.email,
        roles: data.roles,
        publicKey: data.stellar_public_key,
        phone: data.phone || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        organization: data.organization,
        roles: data.roles,
        stellar_public_key: data.stellar_public_key,
        country: data.country,
        city: data.city,
        address: data.address,
        has_solar_generation: data.has_solar_generation,
        coords: data.coords ?? null,
        email_verified: !!data.email_verified,
        phone_verified: !!data.phone_verified,
        phone: data.phone || null,
      },
      wallet: {
        publicKey: data.stellar_public_key,
        network: NETWORK_LABEL,
        funded: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "email is required" });
    }

    const { data } = await supabase.from("users").select("id, email, full_name").eq("email", email).single();

    // Always respond 200 to avoid email enumeration
    if (!data) {
      return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    resetTokens.set(token, { userId: data.id, email: data.email, expiresAt });

    // Expire token after 1 hour
    setTimeout(() => resetTokens.delete(token), 60 * 60 * 1000);

    const emailResult = await sendPasswordResetEmail({
      to: data.email,
      fullName: data.full_name,
      resetToken: token,
    });

    // Dev-mode fallback: when no RESEND_API_KEY is configured, email delivery
    // is skipped. Return the reset link directly so developers can still test
    // the reset flow without a mail provider configured.
    const isDev = process.env.NODE_ENV !== "production";
    const emailSkipped = emailResult?.skipped === true;

    if (emailSkipped) {
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${token}`;
      console.log(`[ForgotPassword] DEV — reset link for ${data.email}: ${resetUrl}`);
      return res.json({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
        // Only exposed in non-production when email delivery is unavailable.
        ...(isDev && { dev_reset_url: resetUrl }),
      });
    }

    res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// RESET PASSWORD
// =====================================================

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, error: "token and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "password must be at least 6 characters" });
    }

    const entry = resetTokens.get(token);
    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(400).json({ success: false, error: "invalid or expired reset token" });
    }

    // Look up user to check if they have a verified phone
    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, phone, phone_verified")
      .eq("id", entry.userId)
      .single();

    const hashedPassword = await bcrypt.hash(password, 10);

    // If user has a verified phone → require OTP before committing password change
    if (user?.phone_verified && user?.phone) {
      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store hashed password + OTP keyed by reset token
      resetPhoneCodes.set(token, { userId: entry.userId, hashedPassword, code, expiresAt });
      setTimeout(() => resetPhoneCodes.delete(token), 10 * 60 * 1000);

      // Send OTP via WhatsApp
      const maskedPhone = user.phone.replace(/(\+\d{2})\d+(\d{2})$/, "$1·····$2");
      try {
        const result = await sendWhatsAppVerificationCode({
          to: user.phone,
          fullName: user.full_name,
          code,
        });
        // Dev fallback when Twilio not configured
        if (result?.fallback) {
          console.log(`[ResetPassword] DEV — phone OTP for ${user.phone}: ${code}`);
          return res.json({
            success: true,
            require_phone: true,
            phone_masked: maskedPhone,
            ...(process.env.NODE_ENV !== "production" && { dev_otp: code }),
          });
        }
      } catch (twilioErr) {
        // Don't block reset if WhatsApp fails — log and fall through to direct reset
        console.error("[ResetPassword] WhatsApp OTP failed:", twilioErr.message);
        // Fall through to direct password update below
        resetPhoneCodes.delete(token);
      }

      return res.json({
        success: true,
        require_phone: true,
        phone_masked: maskedPhone,
      });
    }

    // No verified phone — complete password reset directly
    const { error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", entry.userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    resetTokens.delete(token);
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// RESET PASSWORD — CONFIRM PHONE OTP
// Step 2: verify the OTP sent to the user's phone.
// On success, the new password is committed.
// =====================================================

router.post("/reset-password/confirm-phone", async (req, res) => {
  try {
    const { token, code } = req.body;
    if (!token || !code) {
      return res.status(400).json({ success: false, error: "token and code are required" });
    }

    // Validate original reset token still valid
    const resetEntry = resetTokens.get(token);
    if (!resetEntry || Date.now() > resetEntry.expiresAt) {
      return res.status(400).json({ success: false, error: "Reset session expired. Please start over." });
    }

    // Validate phone OTP
    const phoneEntry = resetPhoneCodes.get(token);
    if (!phoneEntry || Date.now() > phoneEntry.expiresAt) {
      return res.status(400).json({ success: false, error: "Verification code expired. Please start over." });
    }

    if (String(code).trim() !== phoneEntry.code) {
      return res.status(400).json({ success: false, error: "Invalid verification code." });
    }

    // Commit the new password
    const { error } = await supabase
      .from("users")
      .update({ password: phoneEntry.hashedPassword })
      .eq("id", phoneEntry.userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Clean up both tokens
    resetTokens.delete(token);
    resetPhoneCodes.delete(token);

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// LIST COUNTERPARTIES (for contract seller selection)
// =====================================================

router.get("/counterparties", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, organization, roles, stellar_public_key, country, city, email_verified, phone_verified, phone",
      )
      .eq("email_verified", true)
      .eq("phone_verified", true)
      .not("stellar_public_key", "is", null)
      .order("full_name", { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const counterparties = (data || []).map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      organization: u.organization,
      roles: u.roles || [],
      stellar_public_key: u.stellar_public_key,
      country: u.country,
      city: u.city,
      email_verified: u.email_verified === true,
      phone_verified: u.phone_verified === true,
      phone_masked: u.phone ? u.phone.replace(/(\+\d{2})\d+(\d{2})/, "$1·····$2") : null,
    }));

    res.json({ success: true, counterparties });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// VERIFY EMAIL
// =====================================================

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, error: "verification token is required" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, email_verified")
      .eq("email_verification_token", token)
      .single();

    if (error || !data) {
      return res.status(400).json({ success: false, error: "invalid or expired verification token" });
    }

    if (data.email_verified) {
      return res.json({ success: true, message: "Email already verified.", already_verified: true });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email_verified: true, email_verification_token: null })
      .eq("id", data.id);

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message });
    }

    // Send welcome email now that email is verified
    const { data: fullUser } = await supabase
      .from("users")
      .select("stellar_public_key")
      .eq("id", data.id)
      .single();

    sendWelcomeEmail({
      to: data.email,
      fullName: data.full_name,
      operatorId: data.id,
      publicKey: fullUser?.stellar_public_key ?? "",
    }).catch((e) => console.warn("[Auth] Welcome email failed:", e.message));

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// RESEND VERIFICATION EMAIL
// =====================================================

router.post("/resend-verification", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "invalid token" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, email_verified")
      .eq("id", decoded.sub || decoded.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "user not found" });
    }

    if (data.email_verified) {
      return res.json({ success: true, message: "Email already verified.", already_verified: true });
    }

    // Generate new verification token
    const newToken = crypto.randomBytes(32).toString("hex");
    await supabase
      .from("users")
      .update({ email_verification_token: newToken })
      .eq("id", data.id);

    const resendResult = await sendVerificationEmail({
      to: data.email,
      fullName: data.full_name,
      verificationToken: newToken,
    });

    const isDev = process.env.NODE_ENV !== "production";
    if (resendResult?.skipped && isDev) {
      const backendUrl = process.env.VITE_API_URL || process.env.BACKEND_URL || "http://localhost:3000";
      const devVerifyUrl = `${backendUrl}/api/auth/verify-email?token=${newToken}`;
      console.log(`[Auth] DEV — verify email link for ${data.email}: ${devVerifyUrl}`);
      return res.json({
        success: true,
        message: "Verification email sent.",
        dev_verify_url: devVerifyUrl,
      });
    }

    res.json({ success: true, message: "Verification email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// GRID PARTICIPANTS (verified users — with or without GPS)
// =====================================================

// City-level coordinate lookup for approximate positioning on the grid map.
// Used when a user has not provided GPS/manual coordinates.
const CITY_COORDS = {
  // ── São Paulo state ────────────────────────────────────────────────────────
  "São Paulo": [-23.5505, -46.6333], "Sao Paulo": [-23.5505, -46.6333],
  "Campinas": [-22.9056, -47.0608],
  "Santos": [-23.9618, -46.3322],
  "Ribeirão Preto": [-21.1775, -47.8103], "Ribeirao Preto": [-21.1775, -47.8103],
  "Sorocaba": [-23.5015, -47.4526],
  "São Bernardo do Campo": [-23.6939, -46.5650], "Sao Bernardo do Campo": [-23.6939, -46.5650],
  "São José dos Campos": [-23.1794, -45.8869], "Sao Jose dos Campos": [-23.1794, -45.8869],
  "Osasco": [-23.5329, -46.7919],
  "Santo André": [-23.6639, -46.5383], "Santo Andre": [-23.6639, -46.5383],
  "Guarulhos": [-23.4543, -46.5337],
  "Bauru": [-22.3246, -49.0733],
  "São José do Rio Preto": [-20.8197, -49.3794], "Sao Jose do Rio Preto": [-20.8197, -49.3794],
  "Jundiaí": [-23.1857, -46.8974], "Jundiai": [-23.1857, -46.8974],
  "Piracicaba": [-22.7253, -47.6492],
  "Franca": [-20.5386, -47.4008],
  "Limeira": [-22.5644, -47.4019],
  "Taubaté": [-23.0229, -45.5558], "Taubate": [-23.0229, -45.5558],
  "Barueri": [-23.5109, -46.8756],
  "Mogi das Cruzes": [-23.5228, -46.1876],
  // ── Rio de Janeiro state ───────────────────────────────────────────────────
  "Rio de Janeiro": [-22.9068, -43.1729],
  "Petrópolis": [-22.505, -43.179], "Petropolis": [-22.505, -43.179],
  "Niterói": [-22.8833, -43.1036], "Niteroi": [-22.8833, -43.1036],
  "Nova Iguaçu": [-22.7592, -43.4511], "Nova Iguacu": [-22.7592, -43.4511],
  "Duque de Caxias": [-22.7856, -43.3117],
  "São Gonçalo": [-22.8268, -43.0535], "Sao Goncalo": [-22.8268, -43.0535],
  "Campos dos Goytacazes": [-21.7609, -41.3306],
  "Volta Redonda": [-22.5231, -44.1042],
  "Angra dos Reis": [-23.0067, -44.318],
  "Resende": [-22.4686, -44.4506],
  "Teresópolis": [-22.4123, -42.9651], "Teresopolis": [-22.4123, -42.9651],
  "Macaé": [-22.3710, -41.7869], "Macae": [-22.3710, -41.7869],
  "Cabo Frio": [-22.8789, -42.0189],
  "Búzios": [-22.7469, -41.8820], "Buzios": [-22.7469, -41.8820],
  "Barra Mansa": [-22.5441, -44.1753],
  // ── Minas Gerais state ────────────────────────────────────────────────────
  "Belo Horizonte": [-19.9167, -43.9345],
  "Uberlândia": [-18.9186, -48.2772], "Uberlandia": [-18.9186, -48.2772],
  "Contagem": [-19.9317, -44.0536],
  "Juiz de Fora": [-21.7608, -43.3504],
  "Betim": [-19.9686, -44.1975],
  "Montes Claros": [-16.7286, -43.8614],
  "Uberaba": [-19.7482, -47.9319],
  "Governador Valadares": [-18.8510, -41.9494],
  "Ipatinga": [-19.4683, -42.5362],
  "Divinópolis": [-20.1386, -44.8853], "Divinopolis": [-20.1386, -44.8853],
  "Sete Lagoas": [-19.4653, -44.2471],
  "Varginha": [-21.5517, -45.4307],
  // ── Northeast ─────────────────────────────────────────────────────────────
  "Salvador": [-12.9714, -38.5014],
  "Fortaleza": [-3.7172, -38.5433],
  "Recife": [-8.0578, -34.8829],
  "São Luís": [-2.5287, -44.3028], "Sao Luis": [-2.5287, -44.3028],
  "Maceió": [-9.6658, -35.735], "Maceio": [-9.6658, -35.735],
  "Natal": [-5.7945, -35.211],
  "Teresina": [-5.0892, -42.8019],
  "João Pessoa": [-7.1195, -34.845], "Joao Pessoa": [-7.1195, -34.845],
  "Aracaju": [-10.9472, -37.0731],
  "Feira de Santana": [-12.2664, -38.9663],
  "Caruaru": [-8.2828, -35.9756],
  "Mossoró": [-5.1875, -37.3441], "Mossoro": [-5.1875, -37.3441],
  "Ilhéus": [-14.7952, -39.0496], "Ilheus": [-14.7952, -39.0496],
  // ── South ─────────────────────────────────────────────────────────────────
  "Curitiba": [-25.4278, -49.2731],
  "Porto Alegre": [-30.0277, -51.2287],
  "Florianópolis": [-27.5954, -48.548], "Florianopolis": [-27.5954, -48.548],
  "Londrina": [-23.3045, -51.1696],
  "Maringá": [-23.4273, -51.9375], "Maringa": [-23.4273, -51.9375],
  "Joinville": [-26.3044, -48.8453],
  "Blumenau": [-26.9194, -49.0661],
  "São José": [-27.5969, -48.6388], "Sao Jose": [-27.5969, -48.6388],
  "Foz do Iguaçu": [-25.5469, -54.5882], "Foz do Iguacu": [-25.5469, -54.5882],
  "Cascavel": [-24.9578, -53.4595],
  "Ponta Grossa": [-25.0945, -50.1633],
  "Caxias do Sul": [-29.1682, -51.1794],
  "Pelotas": [-31.7649, -52.3371],
  "Santa Maria": [-29.6842, -53.8069],
  "Canoas": [-29.9178, -51.1839],
  // ── Center-West ───────────────────────────────────────────────────────────
  "Brasília": [-15.7801, -47.9292], "Brasilia": [-15.7801, -47.9292],
  "Goiânia": [-16.6864, -49.2643], "Goiania": [-16.6864, -49.2643],
  "Campo Grande": [-20.4697, -54.6201],
  "Cuiabá": [-15.6014, -56.0979], "Cuiaba": [-15.6014, -56.0979],
  "Anápolis": [-16.3281, -48.9528], "Anapolis": [-16.3281, -48.9528],
  "Aparecida de Goiânia": [-16.8233, -49.2444], "Aparecida de Goiania": [-16.8233, -49.2444],
  "Rondonópolis": [-16.4727, -54.6358], "Rondonopolis": [-16.4727, -54.6358],
  "Dourados": [-22.2213, -54.8058],
  // ── North ─────────────────────────────────────────────────────────────────
  "Manaus": [-3.1019, -60.025],
  "Belém": [-1.4558, -48.4902], "Belem": [-1.4558, -48.4902],
  "Palmas": [-10.2491, -48.3243],
  "Porto Velho": [-8.7612, -63.9004],
  "Rio Branco": [-9.9754, -67.8249],
  "Boa Vista": [2.8235, -60.6758],
  "Macapá": [0.0356, -51.0705], "Macapa": [0.0356, -51.0705],
  "Santarém": [-2.4448, -54.7081], "Santarem": [-2.4448, -54.7081],
  "Marabá": [-5.3686, -49.1178], "Maraba": [-5.3686, -49.1178],
  // ── Espírito Santo ────────────────────────────────────────────────────────
  "Vitória": [-20.3222, -40.3381], "Vitoria": [-20.3222, -40.3381],
  "Vila Velha": [-20.3297, -40.2922],
  "Serra": [-20.1289, -40.3081],
  "Cariacica": [-20.2633, -40.4197],
};

const COUNTRY_CENTROIDS = {
  "Brazil": [-14.235, -51.925], "Brasil": [-14.235, -51.925],
  "Argentina": [-38.416, -63.616],
  "Colombia": [4.57, -74.297],
  "Chile": [-35.675, -71.543],
  "Peru": [-9.19, -75.015],
  "Uruguay": [-32.522, -55.765],
  "Paraguay": [-23.442, -58.443],
  "Portugal": [39.399, -8.224],
  "Spain": [40.463, -3.749],
  "United States": [37.09, -95.712], "USA": [37.09, -95.712],
};

/**
 * Deterministic jitter from user UUID so approximate positions don't stack.
 * Two calls with the same id always return the same offset (±0.25°).
 */
function idJitter(id = "") {
  const hex = id.replace(/-/g, "").slice(0, 8);
  const n = parseInt(hex, 16) || 0;
  const latJ = ((n % 500) / 500 - 0.5) * 0.5;
  const lngJ = ((Math.floor(n / 500) % 500) / 500 - 0.5) * 0.5;
  return { latJ, lngJ };
}

router.get("/grid-participants", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, organization, roles, stellar_public_key, country, city, coords, email_verified, phone_verified, has_solar_generation, energy_type")
      .eq("email_verified", true)   // must have verified email
      .eq("phone_verified", true)   // must have verified phone (full 2-step verification)
      // coords not required — city-level fallback applied below
      .order("full_name", { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const participants = (data || []).map((u) => {
      const roles = u.roles || [];
      const primaryRole = roles[0] || "USER";

      // Prefer explicitly stored energy_type; fall back to has_solar_generation for legacy accounts
      const VALID_ENERGY = ["SOLAR", "HYDRO", "WIND", "THERMAL", "GRID"];
      let energyType = "GRID";
      if (primaryRole === "GENERATOR") {
        if (u.energy_type && VALID_ENERGY.includes(u.energy_type)) {
          energyType = u.energy_type;
        } else {
          energyType = u.has_solar_generation ? "SOLAR" : "HYDRO";
        }
      }

      // Resolve coordinates: GPS > MANUAL > city lookup > country centroid > Brazil default
      let coords = u.coords;
      let approximateLocation = false;

      if (!coords) {
        approximateLocation = true;
        const city = (u.city || "").trim();
        const country = (u.country || "").trim();
        const { latJ, lngJ } = idJitter(u.id);

        let base = CITY_COORDS[city] || COUNTRY_CENTROIDS[country] || [-14.235, -51.925];
        coords = { lat: base[0] + latJ, lng: base[1] + lngJ, source: "APPROXIMATE" };
      }

      return {
        id: u.id,
        organization: u.organization || u.full_name,
        role: primaryRole,
        energyType,
        settlementAddress: u.stellar_public_key,
        region: `${u.city || "—"} · ${u.country || "—"}`,
        jurisdiction: u.country || "—",
        coords,
        email_verified: u.email_verified,
        approximate_location: approximateLocation,
      };
    });

    res.json({ success: true, participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// UPDATE PHONE NUMBER
// =====================================================

router.post("/update-phone", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "invalid token" });
    }

    const { phone } = req.body;
    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ success: false, error: "A valid phone number is required (min 8 digits)." });
    }

    const userId = decoded.sub || decoded.id;
    const cleanPhone = phone.trim();

    const { error } = await supabase
      .from("users")
      .update({ phone: cleanPhone, phone_verified: false })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, phone: cleanPhone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// SEND PHONE VERIFICATION CODE
// =====================================================

// In-memory store for phone verification codes (userId → { code, expiresAt })
const phoneVerificationCodes = new Map();

router.post("/send-phone-code", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "invalid token" });
    }

    const userId = decoded.sub || decoded.id;
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, phone, phone_verified")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "user not found" });
    }

    if (data.phone_verified) {
      return res.json({ success: true, message: "Phone already verified.", already_verified: true });
    }

    if (!data.phone) {
      return res.status(400).json({ success: false, error: "No phone number registered. Update your profile first." });
    }

    // Generate 6-digit code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    phoneVerificationCodes.set(userId, { code, expiresAt });

    // Expire after 10 minutes
    setTimeout(() => phoneVerificationCodes.delete(userId), 10 * 60 * 1000);

    // Send code via WhatsApp (Twilio)
    const maskedPhone = data.phone.replace(/(\+\d{2})\d+(\d{2})$/, "$1·····$2");
    const whatsappResult = await sendWhatsAppVerificationCode({
      to: data.phone,
      fullName: data.full_name,
      code,
    });

    // Dev fallback: Twilio not configured — return code in response
    if (whatsappResult?.fallback && process.env.NODE_ENV !== "production") {
      console.log(`[SendPhoneCode] DEV — code for ${data.phone}: ${code}`);
      return res.json({
        success: true,
        message: `Verification code sent via WhatsApp to ${maskedPhone}.`,
        dev_code: code,
      });
    }

    res.json({ success: true, message: `Verification code sent via WhatsApp to ${maskedPhone}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// VERIFY PHONE CODE
// =====================================================

router.post("/verify-phone-code", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "invalid token" });
    }

    const userId = decoded.sub || decoded.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: "verification code is required" });
    }

    const entry = phoneVerificationCodes.get(userId);
    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(400).json({ success: false, error: "Code expired or not found. Request a new one." });
    }

    if (entry.code !== String(code).trim()) {
      return res.status(400).json({ success: false, error: "Invalid code." });
    }

    const { error } = await supabase
      .from("users")
      .update({ phone_verified: true })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    phoneVerificationCodes.delete(userId);
    res.json({ success: true, message: "Phone verified successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
