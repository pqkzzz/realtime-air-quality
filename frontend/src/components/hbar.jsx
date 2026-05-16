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
  barColor = "#3B82F6", // Fallback color
  metricUnit = "",
  metricThreshold = 100,
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

  // Logic màu sắc AQI (giống BubbleMap)
  const AQI_LEVELS = [
    { fill: "#34D399" }, // Tốt (0-50)
    { fill: "#FCD34D" }, // Trung bình (51-100)
    { fill: "#FB923C" }, // Kém (101-150)
    { fill: "#F87171" }, // Xấu (151-200)
    { fill: "#C084FC" }, // Rất xấu (201-300)
    { fill: "#FB7185" }, // Nguy hại (>300)
  ];

  const getLevel = (ratio) => {
    if (ratio <= 0.5) return 0;
    if (ratio <= 1.0) return 1;
    if (ratio <= 1.5) return 2;
    if (ratio <= 2.0) return 3;
    if (ratio <= 3.0) return 4;
    return 5;
  };

  const getBarColor = (value) => {
    const ratio = value / (metricKey === "us_aqi" ? 100 : metricThreshold);
    // Lưu ý: BubbleMap có logic: base = val / (metricKey === "us_aqi" ? 10 : 4) nhưng threshold của us_aqi mặc định là 100
    // Ta dùng threshold chuẩn: val / threshold
    return AQI_LEVELS[getLevel(value / metricThreshold)].fill;
  };

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
                backgroundColor: getBarColor(item.value),
                display: "inline-block",
              }}
            />
            <span>
              {metricLabel} trung bình: <strong>{item.value.toFixed(1)}</strong> {metricUnit}
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
          margin={{ top: 10, right: 80, left: 10, bottom: 25 }}
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
              value: metricUnit ? `${metricLabel} (${metricUnit})` : metricLabel,
              position: "insideBottom",
              offset: -15,
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
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
            ))}

            {/* Hiển thị con số ở cuối thanh */}
            <LabelList
              dataKey="value"
              position="right"
              fill="#0F172A"
              fontSize={13}
              fontWeight={700}
              formatter={(val) => metricUnit ? `${val.toFixed(1)} ${metricUnit}` : val.toFixed(1)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HorizontalBarChart;
