import React, { useEffect, useMemo, useState } from "react";
import { useGemini } from "../hooks/useGemini";
import ProvinceSelector from "./ProvinceSelector";
import TimeSeriesLineChart from "../components/TimeSeriesLineChart";
import RadarChart from "../components/RadarChart";
import CalendarHeatmap from "../components/CalendarHeatmap";
import HorizontalBarChart from "../components/hbar";
import ScatterPlot from "../components/scatter";
import AQIBoxPlot from "../components/AQIBoxPlot";
import BubbleMap from "../components/BubbleMap";
import HistogramChart from "../components/HistogramChart";

const MIN_DATE = "2026-04-01";
const MAX_DATE = "2026-05-30"; // Mở rộng lịch đến hết tháng 5

const OVERVIEW_METRICS = {
  us_aqi: { label: "AQI", threshold: 100, decimals: 0 },
  pm2_5: { label: "PM2.5", threshold: 15, decimals: 1 },
  pm10: { label: "PM10", threshold: 45, decimals: 1 },
};

const CORRELATION_Y_METRICS = {
  us_aqi: { label: "AQI", decimals: 0 },
  pm2_5: { label: "PM2.5", decimals: 1 },
  pm10: { label: "PM10", decimals: 1 },
};

const CORRELATION_X_METRICS = {
  pm2_5: { label: "PM2.5", threshold: 15, decimals: 1 },
  pm10: { label: "PM10", threshold: 45, decimals: 1 },
  carbon_monoxide: { label: "CO", threshold: 4000, decimals: 1 },
  nitrogen_dioxide: { label: "NO2", threshold: 25, decimals: 1 },
  sulphur_dioxide: { label: "SO2", threshold: 40, decimals: 1 },
  ozone: { label: "O3", threshold: 100, decimals: 1 },
};

// --- CÁC HÀM XỬ LÝ DATA (Toán học & Thống kê) ---
function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}
function getMonday(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

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

function calculatePearson(xs, ys) {
  const pairs = xs
    .map((x, index) => [x, ys[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return 0;
  const xMean = mean(pairs.map(([x]) => x));
  const yMean = mean(pairs.map(([, y]) => y));
  let num = 0;
  let xDenom = 0;
  let yDenom = 0;
  pairs.forEach(([x, y]) => {
    const xDiff = x - xMean;
    const yDiff = y - yMean;
    num += xDiff * yDiff;
    xDenom += xDiff ** 2;
    yDenom += yDiff ** 2;
  });
  const denom = Math.sqrt(xDenom * yDenom);
  return denom === 0 ? 0 : num / denom;
}

function linearForecast(values) {
  const series = values.filter((value) => Number.isFinite(value));
  if (series.length < 2) return series[series.length - 1] ?? 0;
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(series);
  let num = 0;
  let denom = 0;
  series.forEach((value, index) => {
    const xDiff = index - xMean;
    const yDiff = value - yMean;
    num += xDiff * yDiff;
    denom += xDiff ** 2;
  });
  const slope = denom === 0 ? 0 : num / denom;
  const projected = series[n - 1] + slope * Math.min(24, n);
  return Math.max(projected, series[n - 1]);
}

const getSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return saved;
    }
  }
  return defaultValue;
};

// =========================================================================
// KHỐI COMPONENT KPI PREMIUM
// =========================================================================

function getAqiMeta(avg) {
  if (avg == null) return { label: "--", color: "#94A3B8" };
  if (avg <= 50) return { label: "Tốt", color: "#10B981" };
  if (avg <= 100) return { label: "Trung bình", color: "#F59E0B" };
  if (avg <= 150) return { label: "Kém", color: "#F97316" };
  if (avg <= 200) return { label: "Xấu", color: "#EF4444" };
  if (avg <= 300) return { label: "Rất xấu", color: "#8B5CF6" };
  return { label: "Nguy hiểm", color: "#9F1239" };
}

// ICONS
const IconWind = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);
const IconAlert = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);
const IconMapPin = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconPieChart = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);
const IconActivity = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconCalendarAlert = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="12" y1="14" x2="12" y2="18" />
    <line x1="12" y1="22" x2="12.01" y2="22" />
  </svg>
);

// Template thẻ KPI
const KpiCard = ({
  label,
  value,
  unit,
  status,
  statusColor,
  accent = "#3B82F6",
  icon,
  progress,
  description,
  isHero = false,
  bgColor = "#ffffff",
  valueColor = "#0F172A",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDark = bgColor !== "#ffffff";
  const bgGradient = isDark
    ? `linear-gradient(135deg, #1E293B 0%, #334155 100%)`
    : `linear-gradient(135deg, #ffffff 60%, ${accent}08 100%)`;
  const lblColor = isDark ? "#94A3B8" : "#64748B";
  const iconBg = isDark ? "rgba(255,255,255,0.1)" : `${accent}15`;
  const iconColor = isDark ? "#ffffff" : accent;
  const isGradient = valueColor.includes("gradient");

  const valueStyle = {
    fontSize: isHero ? "30px" : "24px",
    fontWeight: "900",
    margin: 0,
    lineHeight: 1,
    ...(isGradient
      ? {
        backgroundImage: valueColor,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        color: "transparent",
      }
      : { color: isDark ? "#ffffff" : valueColor }),
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        background: bgGradient,
        borderRadius: "14px",
        border: isDark ? "1px solid #475569" : "1px solid #E8EDF4",
        borderLeft: isDark ? `4px solid ${accent}` : "none",
        padding: isHero ? "16px 20px" : "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflow: "hidden",
        boxShadow: isHovered
          ? isDark
            ? `0 8px 20px -4px rgba(0,0,0,0.3)`
            : `0 8px 20px -4px ${accent}25`
          : "0 2px 4px -1px rgba(0,0,0,0.05)",
        transform: isHovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "default",
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "-10px",
          bottom: "-10px",
          opacity: 0.05,
          transform: isHovered
            ? "scale(1.15) rotate(-10deg)"
            : "scale(1) rotate(0deg)",
          transition: "transform 0.4s ease",
          pointerEvents: "none",
          width: 75,
          height: 75,
        }}
      >
        {icon &&
          React.cloneElement(icon, {
            width: 75,
            height: 75,
            color: isDark ? "#ffffff" : accent,
          })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: "700",
            color: lblColor,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              flexShrink: 0,
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: iconBg,
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          position: "relative",
          zIndex: 1,
          flexWrap: "wrap",
        }}
      >
        <h3 style={valueStyle}>{value}</h3>
        {unit && (
          <span
            style={{ fontSize: "12px", fontWeight: "600", color: lblColor }}
          >
            {unit}
          </span>
        )}
      </div>
      {description && (
        <div
          style={{
            fontSize: "12px",
            color: lblColor,
            opacity: 0.8,
            marginTop: "2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {description}
        </div>
      )}
      {status && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            alignSelf: "flex-start",
            background: isDark ? "rgba(255,255,255,0.1)" : `${statusColor}15`,
            borderRadius: "16px",
            padding: "3px 10px",
            marginTop: "2px",
            border: `1px solid ${isDark ? "transparent" : statusColor + "30"}`,
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 4px ${statusColor}`,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: isDark ? "#ffffff" : statusColor,
              whiteSpace: "nowrap",
            }}
          >
            {status}
          </span>
        </div>
      )}
      {progress != null && (
        <div style={{ marginTop: "4px" }}>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: isDark ? "#475569" : "#E2E8F0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: accent,
                borderRadius: "2px",
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 1. Grid Tổng Quan
const OverviewKpiGrid = ({ overviewStats, currentOverviewMetricDecimals }) => {
  const { label: aqiLabel, color: aqiColor } = getAqiMeta(
    overviewStats.average,
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      <KpiCard
        isHero
        label="AQI TRUNG BÌNH KỲ"
        value={
          overviewStats.average == null
            ? "--"
            : formatNumber(overviewStats.average, currentOverviewMetricDecimals)
        }
        status={aqiLabel}
        statusColor={aqiColor}
        bgColor="#1E293B"
        accent="#3B82F6"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0" />
            <path d="M12 8v4l3 3" />
          </svg>
        }
      />
      <KpiCard
        label="CAO NHẤT"
        value={
          overviewStats.max == null
            ? "--"
            : formatNumber(overviewStats.max, currentOverviewMetricDecimals)
        }
        accent="#EF4444"
        status="Đỉnh ô nhiễm"
        statusColor="#EF4444"
        valueColor="linear-gradient(135deg, #FF416C, #FF4B2B)"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        }
      />
      <KpiCard
        label="SỐ TỈNH BÁO ĐỘNG"
        value={
          overviewStats.warningProvinces == null
            ? "--"
            : overviewStats.warningProvinces
        }
        unit="/ 63"
        accent="#3B82F6"
        status="Cảnh báo"
        statusColor="#3B82F6"
        valueColor="linear-gradient(135deg, #36D1DC, #5B86E5)"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      />
      <KpiCard
        label="VƯỢT NGƯỠNG WHO"
        value={
          overviewStats.exceedPct == null
            ? "--"
            : formatPercent(overviewStats.exceedPct, 1)
        }
        accent="#8B5CF6"
        progress={overviewStats.exceedPct ?? 0}
        valueColor="linear-gradient(135deg, #8E2DE2, #4A00E0)"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        }
      />
    </div>
  );
};

// 2. Grid Xu Hướng
const TrendKpiGrid = ({ trendStats }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "16px",
      marginBottom: "24px",
    }}
  >
    <div style={{ gridColumn: "span 2" }}>
      <KpiCard
        isHero
        label="TRUNG BÌNH KỲ"
        value={
          trendStats.average == null
            ? "--"
            : formatNumber(trendStats.average, 0)
        }
        unit="AQI"
        bgColor="#1E293B"
        accent="#3B82F6"
        status={
          trendStats.average != null ? getAqiMeta(trendStats.average).label : ""
        }
        statusColor={
          trendStats.average != null
            ? getAqiMeta(trendStats.average).color
            : "#94A3B8"
        }
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
        }
      />
    </div>
    <div style={{ gridColumn: "span 2" }}>
      <KpiCard
        isHero
        label="MỨC ĐỘ BIẾN ĐỘNG"
        value={formatPercent(trendStats.volatility, 1)}
        accent="#10B981"
        status="Dao động"
        statusColor="#10B981"
        valueColor="linear-gradient(135deg, #10B981, #059669)"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        }
      />
    </div>
    <KpiCard
      label="NGÀY VƯỢT"
      value={trendStats.exceedDays ?? "--"}
      unit="ngày"
      accent="#EF4444"
      status={trendStats.exceedDays > 0 ? "Vượt ngưỡng" : "An toàn"}
      statusColor={trendStats.exceedDays > 0 ? "#EF4444" : "#10B981"}
      valueColor="linear-gradient(135deg, #FF416C, #FF4B2B)"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      }
    />
    <KpiCard
      label="CAO / THẤP"
      value={`${formatNumber(trendStats.max, 0)}`}
      unit={`/ ${formatNumber(trendStats.min, 0)}`}
      accent="#3B82F6"
      description="Max / Min"
      valueColor="#0F172A"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="7 15 12 20 17 15" />
          <polyline points="7 9 12 4 17 9" />
        </svg>
      }
    />
    <KpiCard
      label="DỰ BÁO ĐỈNH"
      value={formatNumber(trendStats.forecastPeak, 0)}
      accent="#D97706"
      status="Tuyến tính"
      statusColor="#D97706"
      valueColor="linear-gradient(135deg, #F2994A, #F2C94C)"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      }
    />
    <KpiCard
      label="GIỜ RỦI RO"
      value={trendStats.riskHours ?? "--"}
      unit="giờ"
      accent="#EF4444"
      description="AQI ≥ 100"
      valueColor="linear-gradient(135deg, #BE123C, #EF4444)"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      }
    />
  </div>
);

// 3. Grid Tương Quan
const CorrelationKpiGrid = ({ correlationStats }) => {
  const pearson = correlationStats.pearson;
  const strength =
    pearson == null
      ? ""
      : Math.abs(pearson) >= 0.7
        ? "Tương quan mạnh"
        : Math.abs(pearson) >= 0.4
          ? "Tương quan vừa"
          : "Tương quan yếu";
  const strengthColor =
    pearson == null
      ? "#94A3B8"
      : Math.abs(pearson) >= 0.4
        ? "#3B82F6"
        : "#EF4444";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      <KpiCard
        isHero
        label="HỆ SỐ TƯƠNG QUAN PEARSON"
        value={pearson == null ? "--" : formatNumber(pearson, 3)}
        bgColor="#1E293B"
        accent="#3B82F6"
        status={strength}
        statusColor={strengthColor}
        progress={pearson != null ? Math.abs(pearson) * 100 : null}
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        }
      />
      <KpiCard
        isHero
        label="THÀNH PHẦN CHÍNH GÂY Ô NHIỄM"
        value={correlationStats.dominantComponent ?? "--"}
        accent="#EA580C"
        status="Chủ đạo"
        statusColor="#EA580C"
        valueColor="linear-gradient(135deg, #F2994A, #F2C94C)"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
          </svg>
        }
      />
    </div>
  );
};
// =========================================================================

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [activeTab, setActiveTab] = useState(() =>
    getSavedState("activeTab", "overview"),
  );

  const [selectedOverviewProvinces, setSelectedOverviewProvinces] = useState(
    () => getSavedState("selectedOverviewProvinces", []),
  );
  const [selectedOverviewMetric, setSelectedOverviewMetric] = useState(() =>
    getSavedState("selectedOverviewMetric", "us_aqi"),
  );
  const [selectedOverviewStartDate, setSelectedOverviewStartDate] = useState(
    () => getSavedState("selectedOverviewStartDate", "2026-04-01"),
  );
  const [selectedOverviewEndDate, setSelectedOverviewEndDate] = useState(() =>
    getSavedState("selectedOverviewEndDate", "2026-04-30"),
  );

  const [selectedTrendProvince, setSelectedTrendProvince] = useState(() =>
    getSavedState("selectedTrendProvince", ""),
  );
  const [selectedTrendGranularity, setSelectedTrendGranularity] = useState(() =>
    getSavedState("selectedTrendGranularity", "day"),
  );
  const [selectedTrendDate, setSelectedTrendDate] = useState(() =>
    getSavedState("selectedTrendDate", "2026-04-15"),
  );
  const [heatmapSelectedDate, setHeatmapSelectedDate] = useState("");
  const effectiveTrendDate = heatmapSelectedDate || selectedTrendDate;

  const [selectedCorrelationY, setSelectedCorrelationY] = useState(() =>
    getSavedState("selectedCorrelationY", "us_aqi"),
  );
  const [selectedCorrelationX, setSelectedCorrelationX] = useState(() =>
    getSavedState("selectedCorrelationX", "carbon_monoxide"),
  );
  const [selectedCorrelationProvince, setSelectedCorrelationProvince] =
    useState(() => getSavedState("selectedCorrelationProvince", ""));
  const [selectedCorrelationStartDate, setSelectedCorrelationStartDate] =
    useState(() => getSavedState("selectedCorrelationStartDate", "2026-04-01"));
  const [selectedCorrelationEndDate, setSelectedCorrelationEndDate] = useState(
    () => getSavedState("selectedCorrelationEndDate", "2026-04-30"),
  );

  // 1. KẾT NỐI API TRỰC TIẾP ĐẾN BACKEND
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/air-quality/all",
        );
        if (!response.ok) throw new Error("API chưa sẵn sàng hoặc lỗi server");

        const result = await response.json();

        if (!cancelled && result.length > 0) {
          const mappedData = result.map((row) => {
            const rawDatetime = row.datetime ?? "";
            const dateKey =
              row.dateKey ??
              (rawDatetime.includes("T")
                ? rawDatetime.slice(0, 10)
                : rawDatetime.slice(0, 10));

            return {
              ...row,
              province: row.province ?? "",
              latitude: Number(row.latitude ?? 0),
              longitude: Number(row.longitude ?? 0),
              datetime: rawDatetime,
              dateKey,
              hour:
                row.hour !== undefined
                  ? Number(row.hour)
                  : parseInt(
                    rawDatetime.split(/[ T]/)[1]?.split(":")[0] ?? "0",
                    10,
                  ),
              carbon_monoxide: Number(row.carbon_monoxide ?? row.co ?? 0),
              nitrogen_dioxide: Number(row.nitrogen_dioxide ?? 0),
              sulphur_dioxide: Number(row.sulphur_dioxide ?? 0),
              ozone: Number(row.ozone ?? 0),
              pm2_5: Number(row.pm2_5 ?? 0),
              pm10: Number(row.pm10 ?? 0),
              us_aqi: Number(row.us_aqi ?? 0),
              european_aqi: Number(row.european_aqi ?? 0),
            };
          });

          setData(mappedData);
          setLoadError("");

          const dates = mappedData
            .map((r) => r.dateKey)
            .filter(Boolean)
            .sort();
          const earliest = dates[0];
          const latest = dates[dates.length - 1];

          setSelectedOverviewStartDate(latest);
          setSelectedOverviewEndDate(latest);
          setSelectedTrendDate(latest);
          setSelectedCorrelationStartDate(earliest);
          setSelectedCorrelationEndDate(latest);
        }
      } catch (error) {
        console.error("Lỗi fetch API:", error);
        if (!cancelled)
          setLoadError("Không thể kết nối đến server dữ liệu (localhost:3000)");
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const theme = {
    bg: "#F1F5F9",
    sidebar: "#0F172A",
    card: "#FFFFFF",
    textMain: "#0F172A",
    textSub: "#64748B",
    accent: "#3B82F6",
    border: "#E2E8F0",
  };

  const styles = {
    app: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      backgroundColor: theme.bg,
      fontFamily: '"Inter", sans-serif',
    },
    topbar: {
      background: theme.sidebar,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 40px",
      height: "70px",
      flexShrink: 0,
      boxShadow:
        "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    topbarLogo: { display: "flex", alignItems: "center", gap: "14px" },
    topbarTitle: {
      fontSize: "18px",
      fontWeight: "800",
      letterSpacing: "-0.02em",
      margin: 0,
      lineHeight: 1.2,
    },
    topbarSub: {
      fontSize: "11px",
      color: "rgba(255,255,255,0.85)",
      margin: 0,
      letterSpacing: "0.04em",
    },
    topbarActions: { display: "flex", alignItems: "center", gap: "12px" },
    body: { display: "flex", flex: 1, minHeight: 0 },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      marginLeft: "110px",
    },
    mainContent: {
      flex: 1,
      padding: "30px 40px",
      overflowY: "auto",
      minWidth: 0,
    },
    filterSection: {
      display: "flex",
      gap: "20px",
      marginBottom: "30px",
      flexWrap: "wrap",
      alignItems: "flex-end",
    },
    filterBox: { display: "flex", flexDirection: "column", gap: "8px" },
    label: {
      fontSize: "12px",
      fontWeight: "700",
      color: theme.textSub,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    select: {
      padding: "10px 16px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      backgroundColor: theme.card,
      fontSize: "14px",
      color: theme.textMain,
      outline: "none",
      fontWeight: "500",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      transition: "all 0.2s",
    },
    radioGroup: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      height: "40px",
    },
    radioLabel: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "14px",
      fontWeight: "600",
      color: theme.textMain,
      cursor: "pointer",
    },
    chartGrid: { display: "grid", gap: "20px" },
    chartCard: {
      backgroundColor: theme.card,
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
      border: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    },
    chartTitle: {
      fontSize: "16px",
      fontWeight: "800",
      color: theme.textMain,
      marginBottom: "20px",
      textTransform: "uppercase",
    },
  };

  const provinces = useMemo(
    () =>
      Array.from(new Set(data.map((row) => row.province).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [data],
  );
  const overviewMetricThreshold = useMemo(
    () => OVERVIEW_METRICS[selectedOverviewMetric]?.threshold ?? 100,
    [selectedOverviewMetric],
  );

  const overviewRows = useMemo(() => {
    if (!data.length) return [];
    const selectedSet = new Set(selectedOverviewProvinces);
    const useAllProvinces = selectedSet.size === 0;
    return data.filter((row) => {
      const pMatch = useAllProvinces || selectedSet.has(row.province);
      const dMatch =
        row.dateKey >= selectedOverviewStartDate &&
        row.dateKey <= selectedOverviewEndDate;
      return pMatch && dMatch;
    });
  }, [
    data,
    selectedOverviewProvinces,
    selectedOverviewStartDate,
    selectedOverviewEndDate,
  ]);

  const overviewStats = useMemo(() => {
    if (!overviewRows.length)
      return {
        average: null,
        max: null,
        warningProvinces: null,
        exceedPct: null,
      };
    const values = overviewRows
      .map((row) => row[selectedOverviewMetric])
      .filter(Number.isFinite);
    return {
      average: mean(values),
      max: values.length ? Math.max(...values) : 0,
      warningProvinces: new Set(
        overviewRows
          .filter(
            (row) => row[selectedOverviewMetric] >= overviewMetricThreshold,
          )
          .map((row) => row.province),
      ).size,
      exceedPct: values.length
        ? (values.filter((v) => v >= overviewMetricThreshold).length /
          values.length) *
        100
        : 0,
    };
  }, [overviewRows, selectedOverviewMetric, overviewMetricThreshold]);

  const trendRows = useMemo(() => {
    if (!data.length) return [];
    const currentDate = parseDateKey(effectiveTrendDate);
    const [startDate, endDate] =
      selectedTrendGranularity === "week"
        ? [
          getMonday(effectiveTrendDate),
          addDays(getMonday(effectiveTrendDate), 6),
        ]
        : [currentDate, currentDate];
    const sK = formatDateKey(startDate);
    const eK = formatDateKey(endDate);
    return data.filter(
      (row) =>
        (!selectedTrendProvince || row.province === selectedTrendProvince) &&
        row.dateKey >= sK &&
        row.dateKey <= eK,
    );
  }, [
    data,
    selectedTrendProvince,
    selectedTrendGranularity,
    effectiveTrendDate,
  ]);

  const trendAqiValues = useMemo(
    () => trendRows.map((row) => row.us_aqi).filter(Number.isFinite),
    [trendRows],
  );

  const trendStats = useMemo(() => {
    if (!trendRows.length)
      return {
        average: null,
        exceedDays: null,
        volatility: null,
        max: null,
        min: null,
        forecastPeak: null,
        riskHours: null,
      };
    const threshold = 100;
    const values = trendAqiValues;
    const byDay = new Map();
    trendRows.forEach((row) => {
      if (!byDay.has(row.dateKey)) byDay.set(row.dateKey, []);
      byDay.get(row.dateKey).push(row.us_aqi);
    });
    return {
      average: mean(values),
      exceedDays: Array.from(byDay.values()).filter(
        (dayValues) => mean(dayValues) >= threshold,
      ).length,
      volatility:
        mean(values) === 0
          ? 0
          : (standardDeviation(values) / mean(values)) * 100,
      max: values.length ? Math.max(...values) : 0,
      min: values.length ? Math.min(...values) : 0,
      forecastPeak: linearForecast(values.slice(-24)),
      riskHours: values.filter((value) => value >= threshold).length,
    };
  }, [trendRows, trendAqiValues]);

  const histogramData = useMemo(() => {
    if (!trendAqiValues.length) return [];
    const bins = [
      { name: "Tốt", count: 0, color: "#34D399", min: 0, max: 50 },
      { name: "TB", count: 0, color: "#FCD34D", min: 51, max: 100 },
      { name: "Kém", count: 0, color: "#FB923C", min: 101, max: 150 },
      { name: "Xấu", count: 0, color: "#F87171", min: 151, max: 200 },
      { name: "Rất xấu", count: 0, color: "#C084FC", min: 201, max: 300 },
      { name: "Nguy hại", count: 0, color: "#FB7185", min: 301, max: 999 },
    ];
    trendAqiValues.forEach((val) => {
      const b = bins.find((b) => val >= b.min && val <= b.max);
      if (b) b.count += 1;
    });
    return bins.filter((b) => b.count > 0);
  }, [trendAqiValues]);

  const correlationRows = useMemo(() => {
    if (!data.length) return [];
    return data.filter(
      (row) =>
        (!selectedCorrelationProvince ||
          row.province === selectedCorrelationProvince) &&
        row.dateKey >= selectedCorrelationStartDate &&
        row.dateKey <= selectedCorrelationEndDate,
    );
  }, [
    data,
    selectedCorrelationProvince,
    selectedCorrelationStartDate,
    selectedCorrelationEndDate,
  ]);

  const correlationStats = useMemo(() => {
    if (!correlationRows.length)
      return { pearson: null, dominantComponent: null };
    const yV = correlationRows.map((row) => row[selectedCorrelationY]);
    const xV = correlationRows.map((row) => row[selectedCorrelationX]);
    return {
      pearson: calculatePearson(xV, yV),
      dominantComponent:
        CORRELATION_X_METRICS[selectedCorrelationX]?.label ??
        selectedCorrelationX,
    };
  }, [correlationRows, selectedCorrelationX, selectedCorrelationY]);

  const currentOverviewMetricLabel =
    OVERVIEW_METRICS[selectedOverviewMetric]?.label ?? "AQI";
  const currentOverviewMetricDecimals =
    OVERVIEW_METRICS[selectedOverviewMetric]?.decimals ?? 0;

  const IconOverview = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    </svg>
  );
  const IconTrend = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
  const IconCorrelation = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
  );

  // === GEMINI AI ENGINE ===
  const { generateInsight, loadingAI } = useGemini();
  const [insightT1, setInsightT1] = useState("");
  const [insightT2, setInsightT2] = useState("Bấm 'Phân tích' để bắt đầu.");
  const [insightT3, setInsightT3] = useState("Bấm 'Phân tích' để bắt đầu.");

  useEffect(() => {
    if (
      activeTab === "overview" &&
      overviewRows.length > 0 &&
      !insightT1 &&
      !loadingAI
    ) {
      handleCallAI("overview");
    }
  }, [activeTab, overviewRows, insightT1, loadingAI]);

  useEffect(() => {
    setInsightT1("");
  }, [
    selectedOverviewProvinces,
    selectedOverviewStartDate,
    selectedOverviewEndDate,
    selectedOverviewMetric,
  ]);

  const handleCallAI = async (tab) => {
    if (tab === "overview") {
      const provinceGroups = {};
      overviewRows.forEach((row) => {
        if (!provinceGroups[row.province])
          provinceGroups[row.province] = { totalAqi: 0, count: 0 };
        provinceGroups[row.province].totalAqi += row.us_aqi;
        provinceGroups[row.province].count += 1;
      });
      const aggregatedList = Object.keys(provinceGroups)
        .map((prov) => ({
          province: prov,
          avg_aqi: provinceGroups[prov].totalAqi / provinceGroups[prov].count,
        }))
        .sort((a, b) => b.avg_aqi - a.avg_aqi);

      const payloadT1 = {
        trung_binh_chung: overviewStats.average?.toFixed(1) || "0",
        so_tinh_vuot_nguong: overviewStats.warningProvinces || 0,
        top_3_o_nhiem: aggregatedList.slice(0, 3).map((r) => r.province),
        top_3_trong_lanh: [...aggregatedList]
          .reverse()
          .slice(0, 3)
          .map((r) => r.province),
      };
      const result = await generateInsight(payloadT1);
      setInsightT1(result);
    } else if (tab === "trend") {
      const payloadT2 = {
        average: trendStats.average?.toFixed(1),
        max: trendStats.max,
        min: trendStats.min,
        exceedDays: trendStats.exceedDays,
        volatility: trendStats.volatility?.toFixed(1) + "%",
        riskHours: trendStats.riskHours,
      };
      const result = await generateInsight(payloadT2);
      setInsightT2(result);
    } else if (tab === "correlation") {
      const payloadT3 = {
        bien_Y: CORRELATION_Y_METRICS[selectedCorrelationY]?.label,
        bien_X: CORRELATION_X_METRICS[selectedCorrelationX]?.label,
        he_so_Pearson: correlationStats.pearson?.toFixed(2),
        thanh_phan_chu_dao: correlationStats.dominantComponent,
      };
      const result = await generateInsight(payloadT3);
      setInsightT3(result);
    }
  };

  return (
    <div style={styles.app}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          
          /* Cải tiến Hover cho KPI Card */
          .hover-kpi-card:hover {
            transform: translateY(-4px) !important;
            box-shadow: 0 15px 30px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04) !important;
          }

          .sidebar-rail { width: 80px; height: auto; max-height: 80vh; background: rgba(17, 28, 68, 0.9) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 35px; position: fixed; left: 20px; top: 50%; transform: translateY(-50%); z-index: 1000; display: flex; flex-direction: column; padding: 25px 0; box-shadow: 0 20px 40px rgba(0,0,0,0.2); transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) !important; overflow: hidden; }
          .sidebar-rail:hover { width: 260px; border-radius: 25px; }
          .nav-rail-btn { width: 54px; height: 54px; border-radius: 18px; border: none; background: transparent; color: #94A3B8; display: flex; align-items: center; justify-content: flex-start; padding-left: 17px; cursor: pointer; transition: all 0.3s; position: relative; margin: 8px auto; flex-shrink: 0; overflow: hidden; white-space: nowrap; }
          .sidebar-rail:hover .nav-rail-btn { width: 220px; justify-content: flex-start; padding: 0 20px; margin: 6px 20px; }
          .nav-rail-btn.active { background: #4318FF; color: #FFFFFF; box-shadow: 0 10px 20px rgba(67, 24, 255, 0.3); }
          .nav-rail-btn:hover:not(.active) { background: rgba(255, 255, 255, 0.1); color: #FFFFFF; }
          .nav-rail-label { opacity: 0; transition: opacity 0.2s ease, transform 0.2s ease; transform: translateX(-10px); margin-left: 15px; font-weight: 600; font-size: 14px; pointer-events: none; }
          .sidebar-rail:hover .nav-rail-label { opacity: 1; transform: translateX(0); transition-delay: 0.1s; pointer-events: auto; }
          .nav-rail-icon { font-size: 20px; flex-shrink: 0; transition: transform 0.3s; display: flex; align-items: center; justify-content: center; }
          .sidebar-rail:hover .nav-rail-icon { transform: scale(1.1); }
          .topbar-pill-btn { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #FFFFFF; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s; }
          .topbar-pill-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.4); }
          
          /* Box AI Insight */
          .insight-box { background: #F8FAFC; border: 1px dashed #3B82F6; border-radius: 16px; padding: 20px; marginBottom: 30px; color: #64748B; font-size: 14px; }
        `}
      </style>

      {/* === TOPBAR === */}
      <div style={styles.topbar}>
        <div style={styles.topbarLogo}>
          <div>
            <p style={styles.topbarTitle}>
              Phân tích Chỉ số Chất lượng Không khí Việt Nam
            </p>
            <p style={styles.topbarSub}>
              GVHD: Nguyễn Tiến Huy • KHTN • HCMUS • Năm 2025–2026
            </p>
          </div>
        </div>
        <div style={styles.topbarActions}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              AQI HIỆN TẠI:
            </span>
            {[
              { max: 50, lbl: "Tốt", c: "#00C853" },
              { max: 100, lbl: "Vừa", c: "#FFD600" },
              { max: 150, lbl: "Nhạy cảm", c: "#FF6D00" },
              { max: 200, lbl: "Xấu", c: "#D50000" },
            ].map(({ lbl, c }) => (
              <span
                key={lbl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    backgroundColor: c,
                    display: "inline-block",
                  }}
                />
                {lbl}
              </span>
            ))}
          </div>
          <button
            className="topbar-pill-btn"
            onClick={() => window.location.reload()}
          >
            <span style={{ fontSize: "14px" }}>⟳</span> Làm mới
          </button>
        </div>
      </div>

      {/* === BODY = RAIL + MAIN === */}
      <div style={styles.body}>
        <div className="sidebar-rail">
          {[
            { tab: "overview", label: "Tổng quan", icon: <IconOverview /> },
            { tab: "trend", label: "Xu hướng", icon: <IconTrend /> },
            {
              tab: "correlation",
              label: "Tương quan",
              icon: <IconCorrelation />,
            },
          ].map(({ tab, label, icon }) => (
            <button
              key={tab}
              className={`nav-rail-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
              title={label}
            >
              <span className="nav-rail-icon">{icon}</span>
              <span className="nav-rail-label">{label}</span>
            </button>
          ))}
        </div>

        {/* --- MAIN AREA --- */}
        <div style={styles.main}>
          <div style={styles.mainContent}>
            {/* ================= TAB 1: OVERVIEW ================= */}
            {activeTab === "overview" && (
              <>
                <OverviewKpiGrid
                  overviewStats={overviewStats}
                  currentOverviewMetricDecimals={currentOverviewMetricDecimals}
                  selectedOverviewMetric={selectedOverviewMetric}
                />

                {/* KHỐI AI INSIGHT GIỮ NGUYÊN LOGIC CŨ */}
                <div
                  className="insight-box"
                  style={{
                    marginBottom: "25px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "16px",
                    padding: "16px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#0F172A",
                      fontWeight: "800",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>✨</span> AI INSIGHT TỔNG
                    QUAN
                    {loadingAI && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#3B82F6",
                          fontWeight: "bold",
                        }}
                      >
                        {" "}
                        (Đang phân tích...)
                      </span>
                    )}
                  </h4>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      color: "#475569",
                      fontSize: "13px",
                      lineHeight: "1.5",
                    }}
                  >
                    {insightT1 || "Đang kết nối dữ liệu..."}
                  </pre>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr",
                    gap: "25px",
                  }}
                >
                  <div
                    className="hover-card"
                    style={{
                      ...styles.chartCard,
                      gridRow: "span 2",
                      padding: "12px",
                    }}
                  >
                    <h3
                      style={{ ...styles.chartTitle, padding: "10px 0 0 15px" }}
                    >
                      Bản đồ phân bố không gian
                    </h3>
                    <BubbleMap
                      overviewRows={overviewRows}
                      selectedOverviewMetric={selectedOverviewMetric}
                      overviewMetricThreshold={overviewMetricThreshold}
                      currentOverviewMetricLabel={currentOverviewMetricLabel}
                      currentOverviewMetricDecimals={
                        currentOverviewMetricDecimals
                      }
                    />
                  </div>
                  <div className="hover-card" style={styles.chartCard}>
                    <h3 style={styles.chartTitle}>Top 5 Ô nhiễm nhất</h3>
                    <HorizontalBarChart
                      rows={overviewRows}
                      metricKey={selectedOverviewMetric}
                      metricLabel={currentOverviewMetricLabel}
                      topN={5}
                      order="desc"
                      barColor="#EF4444"
                    />
                  </div>
                  <div className="hover-card" style={styles.chartCard}>
                    <h3 style={styles.chartTitle}>Top 5 Trong lành nhất</h3>
                    <HorizontalBarChart
                      rows={overviewRows}
                      metricKey={selectedOverviewMetric}
                      metricLabel={currentOverviewMetricLabel}
                      topN={5}
                      order="asc"
                      barColor="#10B981"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ================= TAB 2: TREND ================= */}
            {activeTab === "trend" && (
              <>
                <div style={styles.filterSection}>
                  <div style={styles.filterBox}>
                    <span style={styles.label}>Chọn vùng</span>
                    <select
                      className="hover-input"
                      value={selectedTrendProvince}
                      onChange={(e) => setSelectedTrendProvince(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">Toàn quốc</option>
                      {provinces.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.filterBox}>
                    <span style={styles.label}>Chế độ</span>
                    <div style={styles.radioGroup}>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          checked={selectedTrendGranularity === "day"}
                          onChange={() => setSelectedTrendGranularity("day")}
                        />{" "}
                        Ngày
                      </label>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          checked={selectedTrendGranularity === "week"}
                          onChange={() => setSelectedTrendGranularity("week")}
                        />{" "}
                        Tuần
                      </label>
                    </div>
                  </div>
                  <div style={styles.filterBox}>
                    <span style={styles.label}>Mốc thời gian</span>
                    <input
                      className="hover-input"
                      type="date"
                      min={MIN_DATE}
                      max={MAX_DATE}
                      value={selectedTrendDate}
                      onChange={(e) => setSelectedTrendDate(e.target.value)}
                      style={styles.select}
                    />
                  </div>
                </div>

                <TrendKpiGrid trendStats={trendStats} />

                {/* KHỐI AI INSIGHT GIỮ NGUYÊN LOGIC CŨ */}
                <div
                  className="insight-box"
                  style={{
                    marginBottom: "25px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "16px",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        color: "#0F172A",
                        fontWeight: "800",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>✨</span> AI INSIGHT XU
                      HƯỚNG
                    </h4>
                    <button
                      onClick={() => handleCallAI("trend")}
                      disabled={loadingAI}
                      style={{
                        padding: "8px 16px",
                        background: loadingAI ? "#94A3B8" : "#0F172A",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: loadingAI ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {loadingAI ? "Đang quét..." : "Phân tích xu hướng"}
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      color: "#475569",
                      fontSize: "14px",
                      lineHeight: "1.6",
                    }}
                  >
                    {insightT2}
                  </pre>
                </div>

                <div style={styles.chartGrid}>
                  <div className="hover-card" style={styles.chartCard}>
                    <h3 style={styles.chartTitle}>Diễn biến chuỗi thời gian</h3>
                    <TimeSeriesLineChart
                      rows={trendRows}
                      granularity={selectedTrendGranularity}
                      threshold={100}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "20px",
                    }}
                  >
                    <div className="hover-card" style={styles.chartCard}>
                      <h3 style={styles.chartTitle}>Dị thường (Boxplot)</h3>
                      <AQIBoxPlot
                        rows={trendRows}
                        granularity={selectedTrendGranularity}
                      />
                    </div>
                    <div className="hover-card" style={styles.chartCard}>
                      <h3 style={styles.chartTitle}>Tần suất phân phối</h3>
                      <HistogramChart histogramData={histogramData} />
                    </div>
                    <div className="hover-card" style={styles.chartCard}>
                      <h3 style={styles.chartTitle}>Ma trận nhiệt độ</h3>
                      <CalendarHeatmap
                        data={trendRows}
                        province={selectedTrendProvince}
                        isCompact={true}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ================= TAB 3: CORRELATION ================= */}
            {activeTab === "correlation" && (
              <>
                <div style={styles.filterSection}>
                  <div style={styles.filterBox}>
                    <span style={styles.label}>Chọn khu vực</span>
                    <select
                      className="hover-input"
                      value={selectedCorrelationProvince}
                      onChange={(e) =>
                        setSelectedCorrelationProvince(e.target.value)
                      }
                      style={styles.select}
                    >
                      <option value="">Toàn quốc</option>
                      {provinces.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.filterBox}>
                    <span style={styles.label}>Thời gian phân tích</span>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        className="hover-input"
                        type="date"
                        value={selectedCorrelationStartDate}
                        onChange={(e) =>
                          setSelectedCorrelationStartDate(e.target.value)
                        }
                        style={styles.select}
                      />
                      <span>đến</span>
                      <input
                        className="hover-input"
                        type="date"
                        value={selectedCorrelationEndDate}
                        onChange={(e) =>
                          setSelectedCorrelationEndDate(e.target.value)
                        }
                        style={styles.select}
                      />
                    </div>
                  </div>
                </div>

                <CorrelationKpiGrid correlationStats={correlationStats} />

                {/* KHỐI AI INSIGHT GIỮ NGUYÊN LOGIC CŨ */}
                <div
                  className="insight-box"
                  style={{
                    marginBottom: "25px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "16px",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        color: "#0F172A",
                        fontWeight: "800",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>✨</span> AI INSIGHT
                      TƯƠNG QUAN
                    </h4>
                    <button
                      onClick={() => handleCallAI("correlation")}
                      disabled={loadingAI}
                      style={{
                        padding: "8px 16px",
                        background: loadingAI ? "#94A3B8" : "#0F172A",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: loadingAI ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {loadingAI ? "Đang quét..." : "Phân tích tương quan"}
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      color: "#475569",
                      fontSize: "14px",
                      lineHeight: "1.6",
                    }}
                  >
                    {insightT3}
                  </pre>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "25px",
                    paddingBottom: "30px",
                  }}
                >
                  <div
                    className="hover-card"
                    style={{ ...styles.chartCard, minHeight: "500px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                      }}
                    >
                      <h3 style={{ ...styles.chartTitle, margin: 0 }}>
                        Đồ thị phân tán
                      </h3>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <select
                          className="hover-input"
                          value={selectedCorrelationY}
                          onChange={(e) =>
                            setSelectedCorrelationY(e.target.value)
                          }
                          style={{
                            ...styles.select,
                            padding: "5px 10px",
                            fontSize: "12px",
                          }}
                        >
                          <option value="us_aqi">Y: AQI</option>
                          <option value="pm2_5">Y: PM2.5</option>
                        </select>
                        <select
                          className="hover-input"
                          value={selectedCorrelationX}
                          onChange={(e) =>
                            setSelectedCorrelationX(e.target.value)
                          }
                          style={{
                            ...styles.select,
                            padding: "5px 10px",
                            fontSize: "12px",
                          }}
                        >
                          <option value="carbon_monoxide">X: CO</option>
                          <option value="nitrogen_dioxide">X: NO2</option>
                          <option value="ozone">X: O3</option>
                        </select>
                      </div>
                    </div>
                    <ScatterPlot
                      rows={correlationRows}
                      xKey={selectedCorrelationX}
                      xLabel={
                        CORRELATION_X_METRICS[selectedCorrelationX]?.label
                      }
                      yKey={selectedCorrelationY}
                      yLabel={
                        CORRELATION_Y_METRICS[selectedCorrelationY]?.label
                      }
                    />
                  </div>
                  <div className="hover-card" style={styles.chartCard}>
                    <h3 style={styles.chartTitle}>Cấu trúc khí thải (Radar)</h3>
                    <RadarChart
                      rows={correlationRows}
                      selectedY={selectedCorrelationY}
                      yLabel={
                        CORRELATION_Y_METRICS[selectedCorrelationY]?.label
                      }
                      yThreshold={100}
                      allXMetrics={CORRELATION_X_METRICS}
                      areaLabel={selectedCorrelationProvince || "Toàn quốc"}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
