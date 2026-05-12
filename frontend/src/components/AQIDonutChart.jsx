import React, { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const METRIC_CONFIG = {
  us_aqi: { label: "AQI", decimals: 0, threshold: 100 },
  pm2_5: { label: "PM2.5", decimals: 1, threshold: 15 },
  pm10: { label: "PM10", decimals: 1, threshold: 45 },
};

const COLORS = {
  T: "#22C55E",
  TB: "#84CC16",
  K: "#F59E0B",
  X: "#EF4444",
  RX: "#A855F7",
  NH: "#7F1D1D",
};

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, decimals)}%`;
}

function formatDate(value) {
  if (!value) return "--";
  const parts = String(value).split("-");
  if (parts.length !== 3) return "--";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function getMetricValue(row, metricKey) {
  const raw = row?.[metricKey] ?? row?.us_aqi ?? row?.AQI;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function buildBands(metricKey) {
  if (metricKey === "us_aqi") {
    return [
      {
        code: "T",
        label: "Tốt",
        range: "0–50",
        test: (v) => v >= 0 && v <= 50,
      },
      {
        code: "TB",
        label: "Trung bình",
        range: "51–100",
        test: (v) => v > 50 && v <= 100,
      },
      {
        code: "K",
        label: "Kém",
        range: "101–150",
        test: (v) => v > 100 && v <= 150,
      },
      {
        code: "X",
        label: "Xấu",
        range: "151–200",
        test: (v) => v > 150 && v <= 200,
      },
      {
        code: "RX",
        label: "Rất xấu",
        range: "201–300",
        test: (v) => v > 200 && v <= 300,
      },
      {
        code: "NH",
        label: "Nguy hại",
        range: ">300",
        test: (v) => v > 300,
      },
    ];
  }

  const threshold = METRIC_CONFIG[metricKey]?.threshold ?? 100;
  const step2 = threshold * 2;
  const step3 = threshold * 3;
  const step5 = threshold * 5;
  const step8 = threshold * 8;

  return [
    {
      code: "T",
      label: "Tốt",
      range: `≤${formatNumber(threshold, 1)}`,
      test: (v) => v >= 0 && v <= threshold,
    },
    {
      code: "TB",
      label: "Trung bình",
      range: `${formatNumber(threshold, 1)}–${formatNumber(step2, 1)}`,
      test: (v) => v > threshold && v <= step2,
    },
    {
      code: "K",
      label: "Kém",
      range: `${formatNumber(step2, 1)}–${formatNumber(step3, 1)}`,
      test: (v) => v > step2 && v <= step3,
    },
    {
      code: "X",
      label: "Xấu",
      range: `${formatNumber(step3, 1)}–${formatNumber(step5, 1)}`,
      test: (v) => v > step3 && v <= step5,
    },
    {
      code: "RX",
      label: "Rất xấu",
      range: `${formatNumber(step5, 1)}–${formatNumber(step8, 1)}`,
      test: (v) => v > step5 && v <= step8,
    },
    {
      code: "NH",
      label: "Nguy hại",
      range: `>${formatNumber(step8, 1)}`,
      test: (v) => v > step8,
    },
  ];
}

function DonutChartAQI({
  rows = [],
  metricKey = "us_aqi",
  provinceLabel = "Toàn quốc",
  dateRangeLabel = "",
  hourLabel = "",
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const metric = METRIC_CONFIG[metricKey] ?? METRIC_CONFIG.us_aqi;
  const bands = useMemo(() => buildBands(metricKey), [metricKey]);

  const chartData = useMemo(() => {
    const values = rows
      .map((row) => getMetricValue(row, metricKey))
      .filter(Number.isFinite);

    const total = values.length;

    return bands.map((band) => {
      const count = values.filter((value) => band.test(value)).length;
      return {
        ...band,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        fill: COLORS[band.code],
      };
    });
  }, [rows, bands, metricKey]);

  const total = useMemo(
    () => chartData.reduce((sum, item) => sum + item.count, 0),
    [chartData]
  );

  const dominant = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((best, item) => (item.count > best.count ? item : best), chartData[0]);
  }, [chartData]);

  const active = hoveredIndex != null ? chartData[hoveredIndex] : dominant;

  const renderTooltip = ({ active: isActive, payload }) => {
    if (!isActive || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div
        style={{
          background: "#0F172A",
          color: "#F8FAFC",
          borderRadius: "12px",
          padding: "10px 12px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
          minWidth: "150px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 800 }}>{item.code} · {item.label}</div>
        <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.95 }}>{item.range}</div>
        <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.95 }}>
          {formatNumber(item.count, 0)} mẫu · {formatPercent(item.percentage, 1)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
            Theo WHO
          </div>
          <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", lineHeight: 1.5 }}>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 12px", minWidth: "110px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Tổng mẫu</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
              {formatNumber(total, 0)}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 12px", minWidth: "150px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Nhóm chiếm đa số</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
              {dominant ? dominant.label : "--"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: "280px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              cx="50%"
              cy="50%"
              innerRadius={78}
              outerRadius={112}
              paddingAngle={2}
              stroke="none"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.code}
                  fill={entry.fill}
                  onMouseEnter={() => setHoveredIndex(index)}
                />
              ))}
            </Pie>

            <Tooltip content={renderTooltip} />

            <text x="50%" y="46%" textAnchor="middle" style={{ fontSize: "26px", fontWeight: 800, fill: "#0F172A" }}>
              {active ? active.code : "--"}
            </text>
            <text x="50%" y="56%" textAnchor="middle" style={{ fontSize: "13px", fontWeight: 700, fill: "#64748B" }}>
              {active ? active.label : "Chưa có dữ liệu"}
            </text>
            <text x="50%" y="66%" textAnchor="middle" style={{ fontSize: "12px", fontWeight: 600, fill: "#94A3B8" }}>
              {active ? formatPercent(active.percentage, 1) : "--"}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {chartData.map((item) => (
          <div
            key={item.code}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "999px",
              padding: "7px 10px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0F172A",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: item.fill,
                flexShrink: 0,
              }}
            />
            <span>{item.code}</span>
            <span style={{ color: "#64748B", fontWeight: 600 }}>{item.range}</span>
            <span style={{ color: "#64748B", fontWeight: 700 }}>{formatPercent(item.percentage, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DonutChartAQI;