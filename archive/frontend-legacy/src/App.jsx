import { useEffect, useState } from "react";
import axios from "axios";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

import OrderBook from "./components/OrderBook";
import DepthChart from "./components/DepthChart";
import "./App.css";

const API = "http://localhost:3000/wallet";
const ISSUER = "GDZLZMAJRPAXYIOGYZ4SHX247CD3Z2XIWNDWXHW4P5NPXSAGET3OSZ2T";

export default function App() {
  const [price, setPrice] = useState(null);
  const [wallet, setWallet] = useState(null);

  const [history, setHistory] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState(null);

  const [privateKey, setPrivateKey] = useState("");
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);

  // ================= FETCH PRICE =================
  const fetchPrice = async () => {
    try {
      const res = await axios.get(`${API}/price/${ISSUER}`);
      setPrice(res.data);

      const p = Number(res.data.midPrice);
      if (!isNaN(p)) {
        setHistory((prev) => [
          ...prev.slice(-30),
          { time: new Date().toLocaleTimeString(), price: p }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= CREATE WALLET =================
  const createWallet = async () => {
    try {
      const res = await axios.post(`${API}/create`);
      setWallet(res.data);

      alert("Carteira criada! ⚠️ Salve sua private key");
    } catch (err) {
      console.error(err);
      alert("Erro ao criar carteira");
    }
  };

  // ================= BUY =================
  const buyEnergy = async () => {
    try {
      if (!selectedPrice) {
        alert("Selecione um preço no order book");
        return;
      }

      setLoading(true);

      await axios.post(`${API}/buy`, {
        buyerPrivateKey: privateKey,
        issuerPublicKey: ISSUER,
        amount: amount.toString(),
        maxXlm: (amount * selectedPrice).toString()
      });

      alert("Compra realizada!");
    } catch (err) {
      console.error(err);
      alert("Erro na compra");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div className="title">⚡ Energy Marketplace</div>

      {/* ================= WALLET ================= */}
      <div className="card">
        <div className="subtitle">🔐 Carteira</div>

        <button className="button" onClick={createWallet}>
          Criar nova carteira
        </button>

        {wallet && (
          <div className="wallet-box">
            <p><b>Public Key:</b> {wallet.publicKey}</p>
            <p><b>Private Key:</b> {wallet.secretKey}</p>
          </div>
        )}
      </div>

      <div className="grid">
        {/* ================= MARKET ================= */}
        <div className="card">
          <div className="subtitle">📈 Mercado</div>

          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line dataKey="price" stroke="#22c55e" />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 20 }}>
            <DepthChart bids={price?.bids} asks={price?.asks} />
          </div>
        </div>

        {/* ================= ORDER + TRADE ================= */}
        <div className="card">
          <div className="subtitle">📊 Order Book</div>

          {price && (
            <OrderBook
              bids={price.bids}
              asks={price.asks}
              onSelectPrice={({ price }) => setSelectedPrice(price)}
              selectedPrice={selectedPrice}
            />
          )}

          <div style={{ marginTop: 20 }}>
            <div className="subtitle">💸 Trade</div>

            <input
              className="input"
              placeholder="Private Key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />

            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />

            {selectedPrice && (
              <div className="price-info selected">
                Preço: {selectedPrice} | Total:{" "}
                {(amount * selectedPrice).toFixed(2)} XLM
              </div>
            )}

            <button
              className="button"
              onClick={buyEnergy}
              disabled={!selectedPrice || loading}
            >
              {loading ? "Executando..." : "Comprar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}