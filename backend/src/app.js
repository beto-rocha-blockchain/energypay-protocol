import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env from backend/ regardless of the process cwd (local dev or nitro import)
dotenv.config({ path: resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";

import p2pRoutes from "./routes/p2p.js";
import x402Routes from "./routes/x402.js";
import walletRoutes from "./routes/walletRoutes.js";
import authRoutes from "./routes/auth.js";
import tokenRoutes from "./routes/tokenRoutes.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import oracleRoutes from "./routes/oracle.js";
import contractRoutes from "./routes/contracts.js";
import notificationRoutes from "./routes/notifications.js";

import { executeSettlement } from "./services/stellarSettlementService.js";
import { NETWORK_NAME, IS_MAINNET } from "./lib/stellar-network.js";
import { supabase } from "./lib/supabase.js";

const app = express();

// ========================================
// Middlewares
// ========================================

app.use(cors());
app.use(express.json());

// ========================================
// API Routes
// ========================================

app.use("/api/wallet", walletRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/p2p", p2pRoutes);
app.use("/api/x402", x402Routes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/oracle", oracleRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/notifications", notificationRoutes);

// ========================================
// Health Check
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    network: NETWORK_NAME,
    settlementEngine: "active",
    api: "EnergyPay Backend",
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// Settlement Telemetry — real Supabase data
// ========================================

app.get("/api/settlements/telemetry", async (req, res) => {
  try {
    const { data: rows, count } = await supabase
      .from("settlements")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50);

    const settlements = rows || [];
    const total = count || 0;
    const completed = settlements.filter(
      (s) => s.status === "SETTLED" || s.status === "CONFIRMED",
    ).length;
    const failed = settlements.filter((s) => s.status === "FAILED").length;
    const pending = settlements.filter(
      (s) => s.status === "PENDING" || s.status === "BROADCASTING",
    ).length;

    const latencyValues = settlements
      .map((s) => Number(s.finality_ms || s.latency_ms || 0))
      .filter((v) => v > 0);
    const avgLatency =
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
        : 0;

    const recent_receipts = settlements.slice(0, 5).map((s) => ({
      id: s.settlement_id || s.id,
      status: s.status,
      amount: s.amount_brl ? String(Number(s.amount_brl).toFixed(2)) : "0.00",
      asset: "EPWR",
      tx_hash: s.tx_hash || null,
      latency_ms: Number(s.finality_ms || s.latency_ms || 0),
      created_at: s.created_at,
    }));

    res.json({
      success: true,
      counters: {
        total_settlements: total,
        pending_settlements: pending,
        completed_settlements: completed,
        failed_settlements: failed,
        latency_ms: avgLatency,
      },
      recent_receipts,
      recent_logs: [],
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    // settlements table may not exist yet — return zeros
    res.json({
      success: true,
      counters: {
        total_settlements: 0,
        pending_settlements: 0,
        completed_settlements: 0,
        failed_settlements: 0,
        latency_ms: 0,
      },
      recent_receipts: [],
      recent_logs: [],
      checked_at: new Date().toISOString(),
      note: err.message,
    });
  }
});

// ========================================
// Execute Settlement
// ========================================

app.post("/api/settlement/execute", async (req, res) => {
  try {
    const result = await executeSettlement();

    res.json({
      txHash: result.txHash,
      ledger: result.ledger,
      successful: result.successful,
    });
  } catch (err) {
    console.error("Settlement execution failed:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ========================================
// Root Route
// ========================================

app.get("/", (req, res) => {
  res.send("🚀 EnergyPay API funcionando");
});

// ========================================
// Start Server
// Local: starts Express server
// Vercel: exports app as serverless function
// ========================================

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 API rodando em http://localhost:${PORT}`);
  });
}

export default app;