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
} from "recharts";

const BLUE = "#3B82F6"; // Same blue as RadarChart.jsx

/**
 * Biểu đồ Cột Ngang Xếp hạng Tỉnh/Thành phố theo chỉ số AQI (hoặc PM2.5, PM10).
 *
 * Props:
 *   rows       – Mảng dữ liệu đã được lọc (theo tỉnh, ngày)
 *   metricKey  – Khóa chỉ số cần hiển thị (us_aqi | pm2_5 | pm10)
 *   metricLabel– Nhãn hiển thị (AQI, PM2.5, PM10)
 *   topN       – Số lượng tỉnh hiển thị (mặc định 5)
 */
const HorizontalBarChart = ({
  rows = [],
  metricKey = "us_aqi",
  metricLabel = "AQI",
  topN = 5,
}) => {
  const chartData = useMemo(() => {
    if (!rows.length) return [];

    // Group by province → compute average of the selected metric
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
      .sort((a, b) => b.value - a.value) // Descending – highest first
      .slice(0, topN);

    return result;
  }, [rows, metricKey, topN]);

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

  const barHeight = 36;
  const chartHeight = Math.max(280, chartData.length * (barHeight + 16) + 70);

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
          <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "14px" }}>
            {item.province}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: BLUE,
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
          margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
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
            width={145}
            tick={{ fill: "#334155", fontSize: 12, fontWeight: 500 }}
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
              <Cell key={`cell-${index}`} fill={BLUE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HorizontalBarChart;
