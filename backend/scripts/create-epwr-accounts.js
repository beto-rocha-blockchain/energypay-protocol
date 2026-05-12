import { Keypair } from "@stellar/stellar-sdk";

const issuer = Keypair.random();
const treasury = Keypair.random();

console.log("\n=== EPWR ISSUER ===");
console.log("PUBLIC:", issuer.publicKey());
console.log("SECRET:", issuer.secret());

console.log("\n=== EPWR TREASURY ===");
console.log("PUBLIC:", treasury.publicKey());
console.log("SECRET:", treasury.secret());