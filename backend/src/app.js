import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import p2pRoutes from "./routes/p2p.js";
import x402Routes from "./routes/x402.js";
import walletRoutes from "./routes/walletRoutes.js";
import authRoutes from "./routes/auth.js";
import tokenRoutes from "./routes/tokenRoutes.js";

import { executeSettlement } from "./services/stellarSettlementService.js";

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

// ========================================
// Health Check
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    network: "stellar-testnet",
    settlementEngine: "active",
    api: "EnergyPay Backend",
    timestamp: new Date().toISOString(),
  });
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