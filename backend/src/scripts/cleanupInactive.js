#!/usr/bin/env node
/**
 * CLI: Cleanup inactive accounts
 *
 * Deletes platform accounts that haven't received funds or executed
 * any settlement within 7 days of registration.
 *
 * Usage:
 *   node backend/src/scripts/cleanupInactive.js              # dry run (preview)
 *   node backend/src/scripts/cleanupInactive.js --execute     # actually delete
 *   node backend/src/scripts/cleanupInactive.js --days 14     # custom threshold
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

const API_URL = process.env.BACKEND_URL || "http://localhost:3000";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const daysIdx = args.indexOf("--days");
const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 7;

console.log("╔══════════════════════════════════════════════╗");
console.log("║   EnergyPay · Inactive Account Cleanup       ║");
console.log("╚══════════════════════════════════════════════╝");
console.log();
console.log(`  Mode:      ${execute ? "🔴 EXECUTE (will delete)" : "🟢 DRY RUN (preview only)"}`);
console.log(`  Threshold: ${days} days`);
console.log(`  API:       ${API_URL}`);
console.log();

try {
  const res = await fetch(`${API_URL}/api/admin/cleanup-inactive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: !execute, days }),
  });

  const data = await res.json();

  if (!data.success) {
    console.error("❌ Error:", data.error);
    process.exit(1);
  }

  console.log(`  Checked:  ${data.checked} account(s)`);
  console.log(`  Deleted:  ${data.deleted}`);
  console.log(`  Kept:     ${data.kept}`);
  console.log();

  if (data.results?.length > 0) {
    console.log("  ┌─────────────────────────────────────────────────┐");
    for (const r of data.results) {
      const icon =
        r.action === "deleted" ? "🗑️ " :
        r.action === "would_delete" ? "⚠️ " :
        r.action === "kept" ? "✅" :
        "❌";
      console.log(`  │ ${icon} ${r.email.padEnd(30)} ${r.action.padEnd(14)} ${r.reason}`);
      if (r.stellar_merge?.merged) {
        console.log(`  │    └─ Stellar merge OK · recovered ${r.stellar_merge.recovered} XLM`);
      }
    }
    console.log("  └─────────────────────────────────────────────────┘");
  }

  if (!execute && data.deleted === 0 && data.results?.some((r) => r.action === "would_delete")) {
    console.log();
    console.log("  💡 Run with --execute to actually delete these accounts.");
  }

  console.log();
  console.log("Done.");
} catch (err) {
  console.error("❌ Failed to reach API:", err.message);
  process.exit(1);
}
