import bcrypt from "bcryptjs";
import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../lib/crypto.js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const password = "123456";

  const password_hash = await bcrypt.hash(password, 10);

  const pair = Keypair.random();

  const encrypted_secret_key = encryptSecret(
    pair.secret()
  );

  const { data, error } = await supabase
    .from("operators")
    .insert({
      email: "operator@energypay.io",
      password_hash,
      stellar_public_key: pair.publicKey(),
      encrypted_secret_key,
      role: "operator",
    })
    .select()
    .single();

  console.log("OPERATOR CREATED:");
  console.log(data);

  console.log("ERROR:");
  console.log(error);
}

main();