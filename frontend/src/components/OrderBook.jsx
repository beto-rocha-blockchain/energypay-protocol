import React from "react";

export default function OrderBook({
  bids = [],
  asks = [],
  onSelectPrice,
  selectedPrice
}) {
  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* ================= ASKS ================= */}
      <div style={{ flex: 1 }}>
        <h3 style={{ color: "#ef4444" }}>🔴 Vendas (asks)</h3>

        <div
          style={{
            background: "#111",
            padding: 10,
            borderRadius: 6
          }}
        >
          {asks.length === 0 && <p>Sem ofertas</p>}

          {asks.map((ask, i) => {
            const price = Number(ask.price);
            const amount = Number(ask.amount);
            const isSelected = selectedPrice === price;

            return (
              <div
                key={i}
                onClick={() =>
                  onSelectPrice({
                    price,
                    side: "buy"
                  })
                }
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "#ef4444",
                  background: isSelected ? "#3f1d1d" : "transparent",
                  border: isSelected ? "1px solid #ef4444" : "none",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "#2a0f0f";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  {/* PREÇO */}
                  <span style={{ minWidth: 70 }}>
                    {price.toFixed(3)}
                  </span>

                  {/* QUANTIDADE */}
                  <span
                    style={{
                      marginLeft: "auto",
                      minWidth: 70,
                      textAlign: "right"
                    }}
                  >
                    {amount.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= BIDS ================= */}
      <div style={{ flex: 1 }}>
        <h3 style={{ color: "#22c55e" }}>🟢 Compras (bids)</h3>

        <div
          style={{
            background: "#111",
            padding: 10,
            borderRadius: 6
          }}
        >
          {bids.length === 0 && <p>Sem ofertas</p>}

          {bids.map((bid, i) => {
            const price = Number(bid.price);
            const amount = Number(bid.amount);
            const isSelected = selectedPrice === price;

            return (
              <div
                key={i}
                onClick={() =>
                  onSelectPrice({
                    price,
                    side: "sell"
                  })
                }
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "#22c55e",
                  background: isSelected ? "#163d2a" : "transparent",
                  border: isSelected ? "1px solid #22c55e" : "none",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "#0f2a1a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  {/* PREÇO */}
                  <span style={{ minWidth: 70 }}>
                    {price.toFixed(3)}
                  </span>

                  {/* QUANTIDADE */}
                  <span
                    style={{
                      marginLeft: "auto",
                      minWidth: 70,
                      textAlign: "right"
                    }}
                  >
                    {amount.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}