import express from "express";
import cors from "cors";

import walletRoutes from "./routes/walletRoutes.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas principais
app.use("/wallet", walletRoutes);

// 🔥 Rota raiz (ESSENCIAL)
app.get("/", (req, res) => {
  res.send("🚀 EnergyPay API funcionando");
});

// Porta
const PORT = 3000;

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});