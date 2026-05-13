import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const HistogramChart = ({ histogramData }) => {
  if (!histogramData || histogramData.length === 0) {
    return (
      <div style={{ height: "250px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
        Chưa có dữ liệu phân phối
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: "250px", width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={histogramData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E2E8F0"
          />
          <XAxis
            dataKey="name"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis fontSize={11} tickLine={false} axisLine={false} />
          <RechartsTooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          />
          <Bar dataKey="count" name="Số mẫu" radius={[4, 4, 0, 0]}>
            {histogramData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
