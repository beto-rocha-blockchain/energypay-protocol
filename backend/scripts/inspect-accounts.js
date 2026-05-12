import "dotenv/config";
import StellarSdk from "@stellar/stellar-sdk";

function inspect(name, secret) {
  if (!secret) {
    console.log(`\n${name}: SECRET NOT FOUND`);
    return;
  }

  const kp =
    StellarSdk.Keypair.fromSecret(secret);

  console.log(`\n=== ${name} ===`);
  console.log("PUBLIC:", kp.publicKey());
  console.log("SECRET:", secret);
}

inspect(
  "ISSUER",
  process.env.ISSUER_SECRET
);

inspect(
  "TREASURY",
  process.env.DISTRIBUTION_SECRET
);

inspect(
  "OPERATOR",
  process.env.STELLAR_SECRET
);