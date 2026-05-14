import React, { useMemo } from "react";
import Chart from "react-apexcharts";

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "--";
  const parts = String(value).split("-");
  if (parts.length !== 3) return "--";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * q;
  const baseIndex = Math.floor(position);
  const rest = position - baseIndex;
  const next = sortedValues[baseIndex + 1];
  if (next === undefined) return sortedValues[baseIndex];
  return sortedValues[baseIndex] + rest * (next - sortedValues[baseIndex]);
}

function getMetricValue(row, metricKey) {
  // Ưu tiên metricKey, nếu không có thử các cột phổ biến
  const raw = row?.[metricKey] ?? row?.us_aqi ?? row?.AQI ?? row?.aqi;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const BoxPlotAnomalies = ({
  rows = [],
  metricKey = "us_aqi",
}) => {
  const chartBundle = useMemo(() => {
    const byDay = new Map();

    rows.forEach((row) => {
      // Đảm bảo lấy đúng dateKey (YYYY-MM-DD)
      const dateKey = row?.dateKey || (row?.datetime ? row.datetime.slice(0, 10) : "");
      const value = getMetricValue(row, metricKey);
      
      if (!dateKey || value === null) return;

      if (!byDay.has(dateKey)) byDay.set(dateKey, []);
      byDay.get(dateKey).push(value);
    });

    const dailyGroups = Array.from(byDay.entries())
      .map(([dateKey, values]) => ({
        dateKey,
        values: values.slice().sort((a, b) => a - b),
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const boxData = [];
    const scatterData = [];

    dailyGroups.forEach(({ dateKey, values }) => {
      // Tính toán các thông số Boxplot
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const q1 = quantile(values, 0.25);
      const median = quantile(values, 0.5);
      const q3 = quantile(values, 0.75);
      
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      // Phân tách dữ liệu thường và dị thường
      const outliers = values.filter(v => v < lowerFence || v > upperFence);
      
      // Boxplot data yêu cầu định dạng [min, q1, median, q3, max]
      // Nếu iqr = 0 (tất cả giá trị bằng nhau), chúng ta vẫn vẽ 1 đường thẳng
      boxData.push({
        x: formatDate(dateKey),
        y: [minVal, q1, median, q3, maxVal].map(v => Number(v.toFixed(1)))
      });

      // Scatter data cho các điểm dị thường
      outliers.forEach(v => {
        scatterData.push({
          x: formatDate(dateKey),
          y: Number(v.toFixed(1))
        });
      });
    });

    return {
      series: [
        {
          name: "Phân phối AQI",
          type: "boxPlot",
          data: boxData
        },
        {
          name: "Dị thường",
          type: "scatter",
          data: scatterData
        }
      ],
      daysCount: dailyGroups.length
    };
  }, [rows, metricKey]);

  const options = {
    chart: {
      type: "boxPlot",
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "'Inter', sans-serif",
      animations: { enabled: true }
    },
    title: { show: false },
    colors: ["#64748B", "#EF4444"], // Xám cho Box, Đỏ cho Outlier
    plotOptions: {
      boxPlot: {
        colors: {
          upper: "#94A3B8",
          lower: "#CBD5E1"
        }
      }
    },
    stroke: {
      colors: ["#475569"]
    },
    grid: {
      borderColor: "#F1F5F9",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } }
    },
    xaxis: {
      type: "category",
      labels: {
        rotate: -45,
        style: { fontSize: "11px", fontWeight: 600, colors: "#64748B" }
      }
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B" },
        formatter: (val) => Math.round(val)
      }
    },
    tooltip: {
      shared: false,
      intersect: true,
      theme: "light"
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      fontWeight: 600,
      labels: { colors: "#475569" }
    }
  };

  if (!rows.length || chartBundle.daysCount === 0) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#94A3B8", fontSize: "14px", fontWeight: "500", border: "1px dashed #E2E8F0", borderRadius: "12px"
      }}>
        Chưa có dữ liệu phân tích
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "300px" }}>
      <Chart
        options={options}
        series={chartBundle.series}
        type="boxPlot"
        height="100%"
      />
    </div>
  );
};

export default BoxPlotAnomalies;
