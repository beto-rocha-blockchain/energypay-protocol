import express from "express";
import bcrypt from "bcrypt";
import axios from "axios";

import { Keypair } from "@stellar/stellar-sdk";

import { supabase } from "../lib/supabase.js";

const router = express.Router();

// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,

      roles,

      country,
      city,
      address,

      organization,

      has_solar_generation,
    } = req.body;

    // =================================================
    // validations
    // =================================================

    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: "missing required fields",
      });
    }

    if (!roles || !roles.length) {
      return res.status(400).json({
        success: false,
        error: "at least one role is required",
      });
    }

    const ALLOWED_ROLES = ["GENERATOR", "SELLER", "INVESTOR", "USER"];

    if (!Array.isArray(roles)) {
      return res.status(400).json({
        success: false,
        error: "roles must be an array",
      });
    }

    const invalidRoles = roles.filter((r) => !ALLOWED_ROLES.includes(r));

    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        error: `invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    // =================================================
    // check existing user
    // =================================================

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "email already registered",
      });
    }

    // =================================================
    // create stellar wallet
    // =================================================

    const pair = Keypair.random();

    const publicKey = pair.publicKey();
    const secretKey = pair.secret();

    // =================================================
    // fund stellar wallet using friendbot
    // =================================================

    try {
      await axios.get(`https://friendbot.stellar.org/?addr=${publicKey}`);
    } catch (friendbotError) {
      console.error("Friendbot Error:", friendbotError.message);

      return res.status(500).json({
        success: false,
        error: "failed to fund stellar wallet",
      });
    }

    // =================================================
    // encrypt password
    // =================================================

    const hashedPassword = await bcrypt.hash(password, 10);

    // =================================================
    // save user
    // =================================================

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,

          password: hashedPassword,

          full_name,

          organization,

          roles,

          stellar_public_key: publicKey,

          // HACKATHON ONLY
          stellar_secret_encrypted: secretKey,

          country,
          city,
          address,

          has_solar_generation,
        },
      ])
      .select();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // =================================================
    // success
    // =================================================

    res.json({
      success: true,

      provisioning: {
        wallet_created: true,
        stellar_funded: true,
        settlement_ready: true,
        roles_assigned: true,
      },

      user: {
        id: data[0].id,

        email,
        full_name,

        organization,

        roles,

        stellar_public_key: publicKey,

        country,
        city,

        has_solar_generation,
      },

      wallet: {
        publicKey,
        network: "STELLAR_TESTNET",
        funded: true,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // =================================================
    // get user
    // =================================================

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(401).json({
        success: false,
        error: "invalid credentials",
      });
    }

    // =================================================
    // validate password
    // =================================================

    const validPassword = await bcrypt.compare(password, data.password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: "invalid credentials",
      });
    }

    // =================================================
    // success
    // =================================================

    res.json({
      success: true,

      user: {
        id: data.id,

        email: data.email,

        full_name: data.full_name,

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

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
