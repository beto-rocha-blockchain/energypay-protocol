import express from "express";
import axios from "axios";

import {
  Keypair,
} from "@stellar/stellar-sdk";

import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post(
  "/register",
  async (req, res) => {
    try {
      const {
        full_name,
        email,
        organization,
        city,
        state,
        role,
      } = req.body;

      if (!full_name || !email || !role) {
        return res.status(400).json({
          success: false,
          error:
            "Missing required fields",
        });
      }

      // Create Stellar wallet
      const pair = Keypair.random();

      const publicKey =
        pair.publicKey();

      const secretKey =
        pair.secret();

      // Fund wallet via Friendbot
      await axios.get(
        `https://friendbot.stellar.org?addr=${publicKey}`
      );

      // Save profile
      const { data, error } =
        await supabase
          .from("profiles")
          .insert([
            {
              full_name,
              email,
              organization,
              city,
              state,
              role,
              wallet_public_key:
                publicKey,
              wallet_secret_key:
                secretKey,
            },
          ])
          .select()
          .single();

      if (error) {
        console.error(error);

        return res.status(500).json({
          success: false,
          error:
            "Failed to save profile",
        });
      }

      return res.json({
        success: true,

        profile: {
          id: data.id,

          full_name:
            data.full_name,

          email: data.email,

          role: data.role,

          organization:
            data.organization,

          city: data.city,

          state: data.state,

          wallet_public_key:
            data.wallet_public_key,
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Registration failed",
      });
    }
  }
);

export default router;