import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function DepthChart({ bids = [], asks = [] }) {
  // 🔥 converter bids (ordem decrescente)
  const bidData = [...bids]
    .sort((a, b) => Number(b.price) - Number(a.price))
    .reduce((acc, curr) => {
      const prev = acc.length ? acc[acc.length - 1].value : 0;
      acc.push({
        price: Number(curr.price),
        value: prev + Number(curr.amount),
        side: "bid"
      });
      return acc;
    }, []);

  // 🔥 converter asks (ordem crescente)
  const askData = [...asks]
    .sort((a, b) => Number(a.price) - Number(b.price))
    .reduce((acc, curr) => {
      const prev = acc.length ? acc[acc.length - 1].value : 0;
      acc.push({
        price: Number(curr.price),
        value: prev + Number(curr.amount),
        side: "ask"
      });
      return acc;
    }, []);

  const data = [...bidData, ...askData];

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="price" />
          <YAxis />
          <Tooltip />

          {/* BIDS */}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            fill="#22c55e33"
            isAnimationActive={false}
          />

          {/* ASKS */}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#ef4444"
            fill="#ef444433"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}