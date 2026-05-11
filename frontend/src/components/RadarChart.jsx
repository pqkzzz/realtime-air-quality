import React, { useMemo } from "react";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const RadarChart = ({ 
  rows = [], 
  selectedY, 
  yLabel, 
  yThreshold,
  allXMetrics, // { key: { label, threshold } }
  areaLabel = "Toàn quốc"
}) => {
  const data = useMemo(() => {
    if (!rows.length || !allXMetrics) return [];

    // Metrics to include: All X metrics + selected Y (if not already an X metric)
    const metricsToShow = [
      ...Object.entries(allXMetrics).map(([key, config]) => ({
        key,
        label: config.label,
        threshold: config.threshold
      }))
    ];

    // If selectedY (e.g. AQI) isn't in the X metrics, add it
    if (!allXMetrics[selectedY]) {
      metricsToShow.push({
        key: selectedY,
        label: yLabel,
        threshold: yThreshold
      });
    }

    return metricsToShow.map(metric => {
      const values = rows.map(r => r[metric.key]).filter(Number.isFinite);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      
      // Normalize to % of threshold (100 = threshold)
      const normalizedValue = Math.min(150, (avg / metric.threshold) * 100);

      return {
        subject: metric.label,
        fullMark: 150,
        value: normalizedValue,
        raw: avg
      };
    });
  }, [rows, selectedY, yLabel, yThreshold, allXMetrics]);

  // If we only have 2 axes, RadarChart renders a line. To make it a "Radar", let's include 
  // the top 3 correlated metrics or just the selected pair + AQI if not already selected.
  // Given the user said "X/Y pair", I will implement it such that it looks clean.
  
  if (!rows.length) {
    return (
      <div style={{ height: "450px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", background: "#F8FAFC", borderRadius: "12px", border: "2px dashed #E2E8F0" }}>
        Không có dữ liệu tương quan
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 450 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div style={{ backgroundColor: "#1E293B", padding: "10px", borderRadius: "8px", color: "#F8FAFC", fontSize: "12px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "4px" }}>{item.subject}</div>
                    <div>Giá trị TB: {item.raw.toFixed(1)}</div>
                    <div>Mức độ: {item.value.toFixed(1)}% ngưỡng</div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Radar
            name={areaLabel}
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.6}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RadarChart;
