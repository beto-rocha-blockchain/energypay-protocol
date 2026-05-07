import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import walletRoutes from "./routes/walletRoutes.js";

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
app.use("/wallet", walletRoutes);

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
    console.error(err);

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
// ========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});