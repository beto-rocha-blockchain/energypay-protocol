import express from "express";
import bcrypt from "bcrypt";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { Keypair } from "@stellar/stellar-sdk";

import { supabase } from "../lib/supabase.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService.js";

const router = express.Router();

// In-memory store for password reset tokens (keyed by token → { userId, email, expiresAt })
// Fine for demo/hackathon; replace with DB table for production.
const resetTokens = new Map();

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
    } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, error: "missing required fields" });
    }

    if (!roles || !roles.length) {
      return res.status(400).json({ success: false, error: "at least one role is required" });
    }

    const ALLOWED_ROLES = ["GENERATOR", "SELLER", "INVESTOR", "USER"];

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

    const pair = Keypair.random();
    const publicKey = pair.publicKey();
    const secretKey = pair.secret();

    try {
      await axios.get(`https://friendbot.stellar.org/?addr=${publicKey}`);
    } catch (friendbotError) {
      console.error("Friendbot Error:", friendbotError.message);
      return res.status(500).json({ success: false, error: "failed to fund stellar wallet" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          password: hashedPassword,
          full_name,
          phone: phone || null,
          organization,
          roles,
          stellar_public_key: publicKey,
          stellar_secret_encrypted: secretKey, // HACKATHON ONLY
          country,
          city,
          address,
          has_solar_generation,
        },
      ])
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const token = jwt.sign(
      {
        sub: data[0].id,
        email: data[0].email,
        roles: data[0].roles,
        phone: data[0].phone || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Send welcome email (non-blocking — don't fail registration if email fails)
    sendWelcomeEmail({
      to: email,
      fullName: full_name,
      operatorId: data[0].id,
      publicKey,
    }).catch((e) => console.warn("[Auth] Welcome email failed:", e.message));

    res.json({
      success: true,
      token,
      user: {
        id: data[0].id,
        email: data[0].email,
        full_name: data[0].full_name,
        phone: data[0].phone || null,
        organization: data[0].organization,
        roles: data[0].roles,
        stellar_public_key: publicKey,
        country: data[0].country,
        city,
        address,
        has_solar_generation,
      },
      provisioning: {
        wallet_created: true,
        stellar_funded: true,
        settlement_ready: true,
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
      },
      wallet: {
        publicKey: data.stellar_public_key,
        network: "STELLAR_TESTNET",
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

    await sendPasswordResetEmail({
      to: data.email,
      fullName: data.full_name,
      resetToken: token,
    });

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

    const hashedPassword = await bcrypt.hash(password, 10);
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

export default router;
