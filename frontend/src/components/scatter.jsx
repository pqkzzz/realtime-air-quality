import React, { useMemo } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const POINT_COLOR = "#3B82F6"; // Blue – same as RadarChart
const LINE_COLOR = "#EF4444";  // Red – regression line

/** Tính hệ số hồi quy tuyến tính y = slope*x + intercept */
function calcLinearRegression(points) {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  points.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Biểu đồ Phân tán kèm Đường Hồi quy Tuyến tính.
 *
 * Props:
 *   rows       – Mảng dữ liệu đã lọc
 *   xKey       – Key của biến X (mặc định: "pm2_5")
 *   xLabel     – Nhãn trục X (mặc định: "PM2.5")
 *   yKey       – Key của biến Y (mặc định: "us_aqi")
 *   yLabel     – Nhãn trục Y (mặc định: "AQI")
 *   maxPoints  – Số điểm tối đa render (tránh quá tải DOM, mặc định 600)
 */
const ScatterPlot = ({
  rows = [],
  xKey = "pm2_5",
  xLabel = "PM2.5",
  yKey = "us_aqi",
  yLabel = "AQI",
  maxPoints = 600,
}) => {
  const { scatterData, regressionLine } = useMemo(() => {
    if (!rows.length) return { scatterData: [], regressionLine: [] };

    // Lọc điểm hợp lệ
    const allPoints = rows
      .map((row) => ({
        x: row[xKey],
        y: row[yKey],
        datetime: row.datetime ?? "",
        province: row.province ?? "",
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    // Sub-sample nếu quá nhiều điểm
    let sampled = allPoints;
    if (allPoints.length > maxPoints) {
      const step = allPoints.length / maxPoints;
      sampled = Array.from({ length: maxPoints }, (_, i) =>
        allPoints[Math.floor(i * step)]
      );
    }

    // Tính hồi quy trên toàn bộ điểm (không sub-sample)
    const regression = calcLinearRegression(allPoints);

    // Tạo đường hồi quy: lấy min/max x, vẽ 2 điểm
    let lineData = [];
    if (regression) {
      const xs = allPoints.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const STEPS = 80;
      const step = (maxX - minX) / STEPS;
      lineData = Array.from({ length: STEPS + 1 }, (_, i) => {
        const x = minX + i * step;
        return { x, y: regression.slope * x + regression.intercept };
      });
    }

    return { scatterData: sampled, regressionLine: lineData };
  }, [rows, xKey, yKey, maxPoints]);

  // Empty state
  if (!rows.length) {
    return (
      <div
        style={{
          height: "450px",
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
        Không có dữ liệu phân tán
      </div>
    );
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      // Ưu tiên lấy payload của Scatter ("Dữ liệu"), tránh nhầm sang payload của Line hồi quy
      const scatterEntry = payload.find((p) => p.name === "Dữ liệu");
      const pt = (scatterEntry ?? payload[0])?.payload;
      if (!pt) return null;

      // Format datetime: "2026-04-15 07:00:00" hoặc "2026-04-15T07:00" → "07:00 - 15/04/2026"
      let datetimeStr = "";
      if (pt.datetime) {
        // Tách bằng "T" hoặc dấu cách
        const sep = pt.datetime.includes("T") ? "T" : " ";
        const [datePart, timePart] = pt.datetime.split(sep);
        let dateFmt = "";
        let timeFmt = "";
        if (datePart) {
          const [y, m, d] = datePart.split("-");
          dateFmt = `${d}/${m}/${y}`; // dd/mm/yyyy (năm 4 chữ số)
        }
        if (timePart) {
          timeFmt = timePart.slice(0, 5); // "HH:MM"
        }
        if (timeFmt && dateFmt) datetimeStr = `${timeFmt} - ${dateFmt}`;
        else datetimeStr = dateFmt || timeFmt;
      }

      return (
        <div
          style={{
            backgroundColor: "#1E293B",
            padding: "10px 14px",
            borderRadius: "10px",
            color: "#F8FAFC",
            fontSize: "13px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
            minWidth: "170px",
          }}
        >
          {pt.province && (
            <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "13px", color: "#93C5FD" }}>
              {pt.province}
            </div>
          )}
          {datetimeStr && (
            <div style={{ marginBottom: "2px", color: "#CBD5E1", fontSize: "12px" }}>
              📅 {datetimeStr}
            </div>
          )}
          <div style={{ marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "6px" }}>
            <div style={{ marginBottom: "3px" }}>
              {xLabel}: <span style={{ color: "#93C5FD", fontWeight: 600 }}>{pt.x?.toFixed(2)}</span>
            </div>
            <div>
              {yLabel}: <strong>{pt.y?.toFixed(1)}</strong>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };


  return (
    <div style={{ width: "100%", height: 450 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="x"
            type="number"
            name={xLabel}
            domain={["auto", "auto"]}
            tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
            axisLine={{ stroke: "#CBD5E1" }}
            tickLine={{ stroke: "#CBD5E1" }}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -15,
              fill: "#64748B",
              fontSize: 13,
              fontWeight: 600,
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yLabel}
            domain={["auto", "auto"]}
            tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
            axisLine={{ stroke: "#CBD5E1" }}
            tickLine={{ stroke: "#CBD5E1" }}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#64748B",
              fontSize: 13,
              fontWeight: 600,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: "12px", paddingBottom: "6px" }}
          />

          {/* Điểm dữ liệu */}
          <Scatter
            name="Dữ liệu"
            data={scatterData}
            fill={POINT_COLOR}
            fillOpacity={0.55}
            r={3}
          />

          {/* Đường hồi quy */}
          <Line
            name="Hồi quy tuyến tính"
            data={regressionLine}
            dataKey="y"
            dot={false}
            activeDot={false}
            stroke={LINE_COLOR}
            strokeWidth={2.5}
            strokeDasharray="0"
            legendType="line"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterPlot;
