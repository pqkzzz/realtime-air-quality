import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const HorizontalBarChart = ({
  rows = [],
  metricKey = "us_aqi",
  metricLabel = "AQI",
  topN = 8,
  order = "desc", // "desc" cho top cao nhất, "asc" cho top thấp nhất
  barColor = "#3B82F6", // Cho phép truyền màu từ bên ngoài
}) => {
  const chartData = useMemo(() => {
    if (!rows.length) return [];

    const grouped = {};
    rows.forEach((row) => {
      const province = row.province;
      if (!province) return;
      const value = row[metricKey];
      if (!Number.isFinite(value)) return;

      if (!grouped[province]) {
        grouped[province] = { sum: 0, count: 0 };
      }
      grouped[province].sum += value;
      grouped[province].count += 1;
    });

    const result = Object.entries(grouped)
      .map(([province, { sum, count }]) => ({
        province,
        value: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => {
        // Nếu là desc (giảm dần) thì b trừ a, nếu asc (tăng dần) thì a trừ b
        return order === "desc" ? b.value - a.value : a.value - b.value;
      })
      .slice(0, topN);

    return result;
  }, [rows, metricKey, topN, order]);

  if (!rows.length) {
    return (
      <div
        style={{
          height: "300px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748B",
          background: "#F8FAFC",
          borderRadius: "12px",
          border: "2px dashed #E2E8F0",
          fontFamily: '"Inter", sans-serif',
        }}
      >
        Không có dữ liệu xếp hạng
      </div>
    );
  }

  const barHeight = 28; // Thu nhỏ cột một chút để chứa 8 item thoải mái
  const chartHeight = Math.max(300, chartData.length * (barHeight + 16) + 70);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "12px 16px",
            borderRadius: "10px",
            color: "#F8FAFC",
            fontSize: "13px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{ fontWeight: 700, marginBottom: "6px", fontSize: "14px" }}
          >
            {item.province}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: barColor,
                display: "inline-block",
              }}
            />
            <span>
              {metricLabel} trung bình: <strong>{item.value.toFixed(1)}</strong>
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: "100%", height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          // Tăng margin phải (right) lên để có đủ chỗ hiển thị con số
          margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "#64748B", fontSize: 12, fontWeight: 500 }}
            axisLine={{ stroke: "#CBD5E1" }}
            tickLine={{ stroke: "#CBD5E1" }}
            label={{
              value: metricLabel,
              position: "insideBottomRight",
              offset: -5,
              fill: "#64748B",
              fontSize: 13,
              fontWeight: 600,
            }}
          />
          <YAxis
            type="category"
            dataKey="province"
            width={120} // Độ rộng cho tên tỉnh
            tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }}
            axisLine={{ stroke: "#CBD5E1" }}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            maxBarSize={barHeight}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={barColor} />
            ))}

            {/* Hiển thị con số ở cuối thanh */}
            <LabelList
              dataKey="value"
              position="right"
              fill="#0F172A"
              fontSize={13}
              fontWeight={700}
              formatter={(val) => val.toFixed(1)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HorizontalBarChart;
