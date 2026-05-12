import React, { useEffect, useMemo, useState } from "react";
import ProvinceSelector from "./ProvinceSelector";
import TimeSeriesLineChart from "../components/TimeSeriesLineChart";
import RadarChart from "../components/RadarChart";
import CalendarHeatmap from "../components/CalendarHeatmap";
import AQIDonutChart from "../components/AQIDonutChart";
import AQIBoxPlot from "../components/AQIBoxPlot";
import BubbleMap from "../components/BubbleMap";
import HistogramChart from "../components/HistogramChart";

const MIN_DATE = "2026-04-01";
const MAX_DATE = "2026-04-30";

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

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);
  return lines
    .slice(1)
    .map((line) => {
      const values = splitCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      return {
        province: row.province ?? "",
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        datetime: row.datetime ?? "",
        dateKey: (row.datetime ?? "").slice(0, 10),
        hour: Number((row.datetime ?? "").slice(11, 13)),
        pm2_5: Number(row.pm2_5),
        pm10: Number(row.pm10),
        carbon_monoxide: Number(row.carbon_monoxide),
        nitrogen_dioxide: Number(row.nitrogen_dioxide),
        sulphur_dioxide: Number(row.sulphur_dioxide),
        ozone: Number(row.ozone),
        us_aqi: Number(row.us_aqi),
        european_aqi: Number(row.european_aqi),
      };
    })
    .filter((row) => row.province && row.dateKey);
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function getMetricThreshold(metric) {
  return OVERVIEW_METRICS[metric]?.threshold ?? 100;
}

function calculatePearson(xs, ys) {
  const pairs = xs
    .map((x, index) => [x, ys[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (pairs.length < 2) return 0;

  const xValues = pairs.map(([x]) => x);
  const yValues = pairs.map(([, y]) => y);

  const xMean = mean(xValues);
  const yMean = mean(yValues);

  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  pairs.forEach(([x, y]) => {
    const xDiff = x - xMean;
    const yDiff = y - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff ** 2;
    yDenominator += yDiff ** 2;
  });

  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function linearForecast(values) {
  const series = values.filter((value) => Number.isFinite(value));
  if (series.length < 2) return series[series.length - 1] ?? 0;

  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(series);

  let numerator = 0;
  let denominator = 0;

  series.forEach((value, index) => {
    const xDiff = index - xMean;
    const yDiff = value - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const projected = series[n - 1] + slope * Math.min(24, n);
  return Math.max(projected, series[n - 1]);
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [selectedOverviewProvinces, setSelectedOverviewProvinces] = useState(
    [],
  );
  const [selectedOverviewMetric, setSelectedOverviewMetric] =
    useState("us_aqi");
  const [selectedOverviewStartDate, setSelectedOverviewStartDate] =
    useState("2026-04-01");
  const [selectedOverviewEndDate, setSelectedOverviewEndDate] =
    useState("2026-04-15");
  const [selectedOverviewHour, setSelectedOverviewHour] = useState("12");

  const [selectedTrendProvince, setSelectedTrendProvince] = useState("");
  const [selectedTrendGranularity, setSelectedTrendGranularity] =
    useState("day");
  const [selectedTrendDate, setSelectedTrendDate] = useState("2026-04-15");

  const [selectedCorrelationY, setSelectedCorrelationY] = useState("us_aqi");
  const [selectedCorrelationX, setSelectedCorrelationX] =
    useState("carbon_monoxide");
  const [selectedCorrelationProvince, setSelectedCorrelationProvince] =
    useState("");
  const [selectedCorrelationStartDate, setSelectedCorrelationStartDate] =
    useState("2026-04-01");
  const [selectedCorrelationEndDate, setSelectedCorrelationEndDate] =
    useState("2026-04-30");

  useEffect(() => {
    let cancelled = false;

    const loadCsv = async () => {
      try {
        const csvUrls = [
          "/aqi_vietnam_april2026.csv",
          "./aqi_vietnam_april2026.csv",
        ];
        let response = null;

        for (const url of csvUrls) {
          response = await fetch(url);
          if (response.ok) break;
          response = null;
        }

        if (!response) {
          throw new Error("CSV not found");
        }

        const text = await response.text();
        const parsed = parseCsv(text);

        if (!cancelled) {
          setData(parsed);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError("Không tải được dữ liệu CSV");
        }
      }
    };

    loadCsv();

    return () => {
      cancelled = true;
    };
  }, []);

  const theme = {
    bg: "#F1F5F9",
    sidebar: "#1E3A8A",
    card: "#FFFFFF",
    textMain: "#0F172A",
    textSub: "#64748B",
    accent: "#3B82F6",
    border: "#E2E8F0",
  };

  const styles = {
    app: {
      display: "flex",
      minHeight: "100vh",
      backgroundColor: theme.bg,
      fontFamily: '"Inter", sans-serif',
    },
    sidebar: {
      width: "280px",
      backgroundColor: theme.sidebar,
      color: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
      padding: "30px 20px",
      boxShadow: "4px 0 15px rgba(0,0,0,0.1)",
      zIndex: 10,
    },
    logoContainer: {
      display: "flex",
      alignItems: "center",
      gap: "15px",
      marginBottom: "50px",
      padding: "0 10px",
    },
    logoIcon: { fontSize: "28px" },
    logoText: {
      fontSize: "22px",
      fontWeight: "800",
      letterSpacing: "0.5px",
      margin: 0,
    },
    navMenu: { display: "flex", flexDirection: "column", gap: "8px" },
    navItem: (isActive) => ({
      padding: "16px 20px",
      borderRadius: "12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backgroundColor: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
      color: "#FFFFFF",
      fontWeight: isActive ? "700" : "500",
      transition: "all 0.3s ease",
      borderLeft: isActive
        ? `4px solid ${theme.accent}`
        : "4px solid transparent",
    }),
    main: { flex: 1, padding: "40px 50px", overflowY: "auto" },
    header: {
      fontSize: "28px",
      fontWeight: "800",
      color: theme.textMain,
      marginBottom: "30px",
      letterSpacing: "-0.5px",
    },
    filterSection: {
      display: "flex",
      gap: "20px",
      marginBottom: "30px",
      flexWrap: "wrap",
    },
    filterBox: { display: "flex", flexDirection: "column", gap: "8px" },
    label: {
      fontSize: "13px",
      fontWeight: "600",
      color: theme.textSub,
      textTransform: "uppercase",
    },
    select: {
      padding: "12px 16px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      backgroundColor: theme.card,
      fontSize: "14px",
      color: theme.textMain,
      minWidth: "220px",
      outline: "none",
      fontWeight: "500",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    },
    radioGroup: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      height: "43px",
      flexWrap: "wrap",
    },
    radioLabel: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "14px",
      fontWeight: "500",
      color: theme.textMain,
      cursor: "pointer",
    },
    kpiGrid: (cols) => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "20px",
      marginBottom: "30px",
    }),
    kpiCard: {
      backgroundColor: theme.card,
      padding: "24px",
      borderRadius: "16px",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      border: `1px solid ${theme.border}`,
    },
    kpiValue: {
      fontSize: "28px",
      fontWeight: "800",
      color: theme.textMain,
      margin: 0,
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
    },
    chartTitle: {
      fontSize: "16px",
      fontWeight: "700",
      color: theme.textMain,
      marginBottom: "20px",
    },
    chartPlaceholder: {
      flex: 1,
      backgroundColor: "#F8FAFC",
      borderRadius: "10px",
      border: "2px dashed #E2E8F0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "300px",
    },
  };

  const provinces = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((row) => row.province).filter(Boolean)),
    );
    return unique.sort((a, b) => a.localeCompare(b, "vi"));
  }, [data]);

  const dates = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((row) => row.dateKey).filter(Boolean)),
    );
    return unique.sort();
  }, [data]);
  const isOverviewSingleDay =
    selectedOverviewStartDate === selectedOverviewEndDate;
  const overviewHourLabel = `${String(selectedOverviewHour).padStart(2, "0")}:00`;

  const overviewRows = useMemo(() => {
    if (!data.length) return [];
    const selectedSet = new Set(selectedOverviewProvinces);
    const useAllProvinces = selectedSet.size === 0;
    const selectedHour = Number(selectedOverviewHour);

    return data.filter((row) => {
      const provinceMatch = useAllProvinces || selectedSet.has(row.province);
      const dateMatch =
        row.dateKey >= selectedOverviewStartDate &&
        row.dateKey <= selectedOverviewEndDate;
      const hourMatch = !isOverviewSingleDay || row.hour === selectedHour;

      return provinceMatch && dateMatch && hourMatch;
    });
  }, [
    data,
    selectedOverviewProvinces,
    selectedOverviewStartDate,
    selectedOverviewEndDate,
    selectedOverviewHour,
    isOverviewSingleDay,
  ]);

  const overviewMetricThreshold = getMetricThreshold(selectedOverviewMetric);

  const overviewStats = useMemo(() => {
    if (!overviewRows.length) {
      return {
        average: null,
        max: null,
        warningProvinces: null,
        exceedPct: null,
      };
    }

    const values = overviewRows
      .map((row) => row[selectedOverviewMetric])
      .filter(Number.isFinite);
    const averageValue = mean(values);
    const maxValue = values.length ? Math.max(...values) : 0;
    const warningProvinces = new Set(
      overviewRows
        .filter((row) => row[selectedOverviewMetric] >= overviewMetricThreshold)
        .map((row) => row.province),
    ).size;
    const exceedPct = values.length
      ? (values.filter((value) => value >= overviewMetricThreshold).length /
          values.length) *
        100
      : 0;

    return {
      average: averageValue,
      max: maxValue,
      warningProvinces,
      exceedPct,
    };
  }, [overviewRows, selectedOverviewMetric, overviewMetricThreshold]);

  const trendRows = useMemo(() => {
    if (!data.length) return [];

    const currentDate = parseDateKey(selectedTrendDate);
    const [startDate, endDate] =
      selectedTrendGranularity === "week"
        ? [
            getMonday(selectedTrendDate),
            addDays(getMonday(selectedTrendDate), 6),
          ]
        : [currentDate, currentDate];

    const startKey = formatDateKey(startDate);
    const endKey = formatDateKey(endDate);

    return data.filter((row) => {
      const provinceMatch =
        !selectedTrendProvince || row.province === selectedTrendProvince;
      const dateMatch = row.dateKey >= startKey && row.dateKey <= endKey;
      return provinceMatch && dateMatch;
    });
  }, [
    data,
    selectedTrendProvince,
    selectedTrendGranularity,
    selectedTrendDate,
  ]);

  const trendAqiValues = useMemo(() => {
    return trendRows
      .slice()
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .map((row) => row.us_aqi)
      .filter(Number.isFinite);
  }, [trendRows]);

  const trendStats = useMemo(() => {
    if (!trendRows.length) {
      return {
        average: null,
        exceedDays: null,
        volatility: null,
        max: null,
        min: null,
        forecastPeak: null,
        riskHours: null,
      };
    }

    const threshold = getMetricThreshold("us_aqi");
    const values = trendAqiValues;
    const averageValue = mean(values);
    const maxValue = values.length ? Math.max(...values) : 0;
    const minValue = values.length ? Math.min(...values) : 0;
    const riskHours = values.filter((value) => value >= threshold).length;

    const byDay = new Map();
    trendRows.forEach((row) => {
      if (!byDay.has(row.dateKey)) {
        byDay.set(row.dateKey, []);
      }
      byDay.get(row.dateKey).push(row.us_aqi);
    });

    const exceedDays = Array.from(byDay.values()).filter(
      (dayValues) => mean(dayValues) >= threshold,
    ).length;
    const volatility =
      averageValue === 0 ? 0 : (standardDeviation(values) / averageValue) * 100;
    const forecastPeak = linearForecast(values.slice(-24));

    return {
      average: averageValue,
      exceedDays,
      volatility,
      max: maxValue,
      min: minValue,
      forecastPeak,
      riskHours,
    };
  }, [trendRows, trendAqiValues]);

  // --- LOGIC CỦA BIỂU ĐỒ TẦN SUẤT ĐÃ ĐƯỢC THÊM LẠI VÀO ĐÂY ---
  const histogramData = useMemo(() => {
    if (!trendAqiValues.length) return [];
    const bins = [
      { name: "Tốt (0-50)", count: 0, color: "#10B981", min: 0, max: 50 },
      { name: "TB (51-100)", count: 0, color: "#F59E0B", min: 51, max: 100 },
      { name: "Kém (101-150)", count: 0, color: "#F97316", min: 101, max: 150 },
      { name: "Xấu (151-200)", count: 0, color: "#EF4444", min: 151, max: 200 },
      {
        name: "Rất xấu (201-300)",
        count: 0,
        color: "#8B5CF6",
        min: 201,
        max: 300,
      },
      {
        name: "Nguy hại (>300)",
        count: 0,
        color: "#7F1D1D",
        min: 301,
        max: Infinity,
      },
    ];

    trendAqiValues.forEach((val) => {
      const targetBin = bins.find((b) => val >= b.min && val <= b.max);
      if (targetBin) targetBin.count += 1;
    });

    return bins.filter((b) => b.count > 0);
  }, [trendAqiValues]);

  const correlationRows = useMemo(() => {
    if (!data.length) return [];

    return data.filter((row) => {
      const provinceMatch =
        !selectedCorrelationProvince ||
        row.province === selectedCorrelationProvince;
      const dateMatch =
        row.dateKey >= selectedCorrelationStartDate &&
        row.dateKey <= selectedCorrelationEndDate;
      return provinceMatch && dateMatch;
    });
  }, [
    data,
    selectedCorrelationProvince,
    selectedCorrelationStartDate,
    selectedCorrelationEndDate,
  ]);

  const correlationStats = useMemo(() => {
    if (!correlationRows.length) {
      return {
        pearson: null,
        dominantComponent: null,
        hazardRate: null,
      };
    }

    const yValues = correlationRows.map((row) => row[selectedCorrelationY]);
    const xValues = correlationRows.map((row) => row[selectedCorrelationX]);
    const pearson = calculatePearson(xValues, yValues);
    const threshold =
      CORRELATION_X_METRICS[selectedCorrelationX]?.threshold ?? Infinity;
    const hazardRate =
      Number.isFinite(threshold) && threshold !== Infinity
        ? (xValues.filter(
            (value) => Number.isFinite(value) && value >= threshold,
          ).length /
            xValues.filter(Number.isFinite).length) *
          100
        : 0;

    return {
      pearson,
      dominantComponent:
        CORRELATION_X_METRICS[selectedCorrelationX]?.label ??
        selectedCorrelationX,
      hazardRate,
    };
  }, [correlationRows, selectedCorrelationX, selectedCorrelationY]);

  const currentOverviewMetricLabel =
    OVERVIEW_METRICS[selectedOverviewMetric]?.label ?? "AQI";
  const currentOverviewMetricDecimals =
    OVERVIEW_METRICS[selectedOverviewMetric]?.decimals ?? 0;

  return (
    <div style={styles.app}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

          .sidebar-container { width: 280px; background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%); display: flex; flex-direction: column; padding: 35px 20px; box-shadow: 4px 0 20px rgba(0,0,0,0.15); z-index: 10; position: sticky; top: 0; height: 100vh; box-sizing: border-box; }
          .sidebar-logo { display: flex; align-items: center; gap: 15px; margin-bottom: 55px; padding: 0 10px; }
          .sidebar-logo-text { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; color: #FFFFFF; background: -webkit-linear-gradient(#FFFFFF, #94A3B8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .nav-menu { display: flex; flex-direction: column; gap: 10px; flex: 1; }
          .nav-item { padding: 16px 20px; border-radius: 14px; cursor: pointer; display: flex; align-items: center; gap: 16px; color: #94A3B8; font-weight: 500; font-size: 15px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid transparent; }
          .nav-item.active { background-color: rgba(59, 130, 246, 0.15); color: #FFFFFF; font-weight: 700; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: inset 4px 0 0 0 #3B82F6; }
          .nav-icon { font-size: 22px; transition: transform 0.3s ease; }
          .nav-item:hover .nav-icon { transform: scale(1.1); }
          .sidebar-footer { padding-top: 25px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }
          .sidebar-footer-text { font-size: 12px; color: #64748B; margin: 4px 0; font-weight: 500; }

          /* === HIỆU ỨNG SIDEBAR (Nâng cấp) === */
          .nav-item:hover { 
            background-color: rgba(255, 255, 255, 0.1); 
            color: #FFFFFF; 
            transform: translateX(8px); 
            box-shadow: -4px 0 15px rgba(59, 130, 246, 0.2); 
          }

          /* === HIỆU ỨNG CHO CARD (KPI & Biểu đồ) === */
          .hover-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .hover-card:hover {
            transform: translateY(-5px); 
            box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important; 
            border-color: #93C5FD !important; 
          }

          /* === HIỆU ỨNG CHO INPUT & SELECT === */
          .hover-input {
            transition: all 0.3s ease;
          }
          .hover-input:hover {
            border-color: #3B82F6 !important;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1) !important;
            transform: translateY(-1px);
          }
          .hover-input:focus {
            border-color: #2563EB !important;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
            outline: none;
          }
        `}
      </style>

      <div className="sidebar-container">
        <div className="sidebar-logo">
          <h1 className="sidebar-logo-text">AQI System</h1>
        </div>

        <div className="nav-menu">
          <div
            className={
              activeTab === "overview" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveTab("overview")}
          >
            <span>Tổng quan không gian</span>
          </div>
          <div
            className={activeTab === "trend" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("trend")}
          >
            <span>Phân tích xu hướng</span>
          </div>
          <div
            className={
              activeTab === "correlation" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveTab("correlation")}
          >
            <span>Phân tích tương quan</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">© 2026 DoAnAQI</p>
          <p className="sidebar-footer-text">IS - HCMUS</p>
        </div>
      </div>

      <div style={styles.main}>
        {loadError ? (
          <div
            style={{ marginBottom: "20px", color: "#DC2626", fontWeight: 600 }}
          >
            {loadError}
          </div>
        ) : null}

        {activeTab === "overview" && (
          <>
            <h2 style={styles.header}>TỔNG QUAN HIỆN TRẠNG KHÔNG GIAN</h2>

            <div style={styles.filterSection}>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chọn tỉnh/thành</span>
                <div
                  className="hover-input"
                  style={{
                    ...styles.select,
                    padding: 0,
                    border: "none",
                    boxShadow: "none",
                    borderRadius: "10px",
                  }}
                >
                  <ProvinceSelector
                    provinces={provinces}
                    value={selectedOverviewProvinces}
                    onChange={setSelectedOverviewProvinces}
                  />
                </div>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chỉ số quan tâm</span>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="overviewMetric"
                      checked={selectedOverviewMetric === "us_aqi"}
                      onChange={() => setSelectedOverviewMetric("us_aqi")}
                    />
                    AQI
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="overviewMetric"
                      checked={selectedOverviewMetric === "pm2_5"}
                      onChange={() => setSelectedOverviewMetric("pm2_5")}
                    />
                    PM2.5
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="overviewMetric"
                      checked={selectedOverviewMetric === "pm10"}
                      onChange={() => setSelectedOverviewMetric("pm10")}
                    />
                    PM10
                  </label>
                </div>
              </div>
              <div
                style={{
                  ...styles.filterBox,
                  flexBasis: "100%",
                  marginTop: "10px",
                }}
              >
                <span style={styles.label}>Khoảng thời gian quan sát</span>
                <div
                  style={{ display: "flex", gap: "15px", alignItems: "center" }}
                >
                  <input
                    className="hover-input"
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={selectedOverviewStartDate}
                    onChange={(event) =>
                      setSelectedOverviewStartDate(event.target.value)
                    }
                    style={{ ...styles.select, minWidth: "200px" }}
                  />
                  <span
                    style={{
                      fontWeight: "600",
                      color: theme.textSub,
                      fontSize: "14px",
                    }}
                  >
                    đến
                  </span>
                  <input
                    className="hover-input"
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={selectedOverviewEndDate}
                    onChange={(event) =>
                      setSelectedOverviewEndDate(event.target.value)
                    }
                    style={{ ...styles.select, minWidth: "200px" }}
                  />
                </div>
                {isOverviewSingleDay && (
                  <div
                    style={{
                      display: "flex",
                      gap: "15px",
                      alignItems: "center",
                      marginTop: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span style={styles.label}>Chọn giờ</span>
                      <select
                        className="hover-input"
                        value={selectedOverviewHour}
                        onChange={(event) =>
                          setSelectedOverviewHour(event.target.value)
                        }
                        style={{ ...styles.select, minWidth: "180px" }}
                      >
                        {Array.from({ length: 24 }, (_, hour) => {
                          const value = String(hour);
                          return (
                            <option key={value} value={value}>
                              {String(hour).padStart(2, "0")}:00
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        color: theme.textSub,
                        fontWeight: 600,
                        marginTop: "24px",
                      }}
                    >
                      Hiển thị theo từng giờ
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.kpiGrid(4)}>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Chỉ số trung bình</span>
                <h3 style={styles.kpiValue}>
                  {overviewStats.average == null
                    ? "--"
                    : `${formatNumber(overviewStats.average, currentOverviewMetricDecimals)} ${currentOverviewMetricLabel !== "AQI" ? currentOverviewMetricLabel : ""}`.trim()}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Mức ô nhiễm cao nhất</span>
                <h3 style={styles.kpiValue}>
                  {overviewStats.max == null
                    ? "--"
                    : `${formatNumber(overviewStats.max, currentOverviewMetricDecimals)} ${currentOverviewMetricLabel !== "AQI" ? currentOverviewMetricLabel : ""}`.trim()}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Số lượng trạm báo động</span>
                <h3 style={styles.kpiValue}>
                  {overviewStats.warningProvinces == null
                    ? "--"
                    : formatNumber(overviewStats.warningProvinces, 0)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Mức vượt chuẩn WHO</span>
                <h3 style={styles.kpiValue}>
                  {overviewStats.exceedPct == null
                    ? "--"
                    : formatPercent(overviewStats.exceedPct, 1)}
                </h3>
              </div>
            </div>

            <div
              style={{
                ...styles.chartGrid,
                gridTemplateColumns: "1.2fr 1fr",
                gridTemplateRows: "auto auto",
              }}
            >
              <div
                className="hover-card"
                style={{
                  ...styles.chartCard,
                  gridRow: "span 2",
                  padding: "10px",
                }}
              >
                <h3
                  style={{
                    ...styles.chartTitle,
                    paddingLeft: "14px",
                    paddingTop: "14px",
                  }}
                >
                  Bubble map
                </h3>

                <BubbleMap
                  overviewRows={overviewRows}
                  selectedOverviewMetric={selectedOverviewMetric}
                  overviewMetricThreshold={overviewMetricThreshold}
                  currentOverviewMetricLabel={currentOverviewMetricLabel}
                  currentOverviewMetricDecimals={currentOverviewMetricDecimals}
                />
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <h3 style={styles.chartTitle}>
                  BIỂU ĐỒ VÀNH KHĂN PHÂN BỐ TRẠNG THÁI
                </h3>

                <AQIDonutChart
                  rows={overviewRows}
                  metric={selectedOverviewMetric}
                  hourLabel={isOverviewSingleDay ? overviewHourLabel : ""}
                />
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <h3 style={styles.chartTitle}>
                  Biểu đồ thanh ngang xếp hạng Tỉnh/Thành
                </h3>
                <div style={styles.chartPlaceholder}></div>
              </div>
            </div>
          </>
        )}

        {activeTab === "trend" && (
          <>
            <h2 style={styles.header}>PHÂN TÍCH XU HƯỚNG THEO KHU VỰC</h2>

            <div style={styles.filterSection}>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chọn 1 tỉnh/thành</span>
                <select
                  className="hover-input"
                  value={selectedTrendProvince}
                  onChange={(event) =>
                    setSelectedTrendProvince(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">Toàn quốc</option>
                  {provinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chế độ xem</span>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="granularity"
                      checked={selectedTrendGranularity === "day"}
                      onChange={() => setSelectedTrendGranularity("day")}
                    />
                    Theo Ngày
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="granularity"
                      checked={selectedTrendGranularity === "week"}
                      onChange={() => setSelectedTrendGranularity("week")}
                    />
                    Theo Tuần
                  </label>
                </div>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chọn ngày</span>
                <input
                  className="hover-input"
                  type="date"
                  min={MIN_DATE}
                  max={MAX_DATE}
                  value={selectedTrendDate}
                  onChange={(event) => setSelectedTrendDate(event.target.value)}
                  style={styles.select}
                />
              </div>
            </div>

            <div style={styles.kpiGrid(6)}>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Trung bình toàn kỳ</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.average == null
                    ? "--"
                    : formatNumber(trendStats.average, 0)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Số ngày vượt chuẩn</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.exceedDays == null
                    ? "--"
                    : formatNumber(trendStats.exceedDays, 0)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Mức độ biến động</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.volatility == null
                    ? "--"
                    : formatPercent(trendStats.volatility, 1)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Cao nhất / Thấp nhất</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.max == null
                    ? "--"
                    : `${formatNumber(trendStats.max, 0)} / ${formatNumber(trendStats.min, 0)}`}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Dự báo đỉnh ô nhiễm</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.forecastPeak == null
                    ? "--"
                    : formatNumber(trendStats.forecastPeak, 0)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Tổng số giờ rủi ro</span>
                <h3 style={styles.kpiValue}>
                  {trendStats.riskHours == null
                    ? "--"
                    : formatNumber(trendStats.riskHours, 0)}
                </h3>
              </div>
            </div>

            <div style={styles.chartGrid}>
              <div className="hover-card" style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Biểu đồ Đường Chuỗi thời gian</h3>
                <TimeSeriesLineChart
                  rows={trendRows}
                  granularity={selectedTrendGranularity}
                  threshold={100}
                />
              </div>
              <div
                style={{
                  ...styles.chartGrid,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                <div className="hover-card" style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>
                    Biểu đồ BOXPLOT: Nhận diện Ngoại lai
                  </h3>

                  <AQIBoxPlot
                    rows={trendRows}
                    granularity={selectedTrendGranularity}
                  />
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>Ma trận Lịch nhiệt</h3>
                  <CalendarHeatmap
                    data={data}
                    province={selectedTrendProvince}
                    isCompact={true}
                  />
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>Biểu đồ Phân phối Tần suất</h3>

                  <HistogramChart histogramData={histogramData} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "correlation" && (
          <>
            <h2 style={styles.header}>PHÂN TÍCH TƯƠNG QUAN CÁC CHỈ SỐ</h2>

            <div style={styles.filterSection}>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chỉ số chính (Biến Y)</span>
                <select
                  className="hover-input"
                  value={selectedCorrelationY}
                  onChange={(event) =>
                    setSelectedCorrelationY(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="us_aqi">AQI</option>
                  <option value="pm2_5">PM2.5</option>
                  <option value="pm10">PM10</option>
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chỉ số thành phần (Biến X)</span>
                <select
                  className="hover-input"
                  value={selectedCorrelationX}
                  onChange={(event) =>
                    setSelectedCorrelationX(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="carbon_monoxide">CO</option>
                  <option value="nitrogen_dioxide">NO2</option>
                  <option value="sulphur_dioxide">SO2</option>
                  <option value="ozone">O3</option>
                  <option value="pm2_5">PM2.5</option>
                  <option value="pm10">PM10</option>
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chọn tỉnh/thành</span>
                <select
                  className="hover-input"
                  value={selectedCorrelationProvince}
                  onChange={(event) =>
                    setSelectedCorrelationProvince(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="">Toàn quốc</option>
                  {provinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  ...styles.filterBox,
                  flexBasis: "100%",
                  marginTop: "10px",
                }}
              >
                <span style={styles.label}>Khoảng thời gian phân tích</span>
                <div
                  style={{ display: "flex", gap: "15px", alignItems: "center" }}
                >
                  <input
                    className="hover-input"
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={selectedCorrelationStartDate}
                    onChange={(event) =>
                      setSelectedCorrelationStartDate(event.target.value)
                    }
                    style={{ ...styles.select, minWidth: "200px" }}
                  />
                  <span
                    style={{
                      fontWeight: "600",
                      color: theme.textSub,
                      fontSize: "14px",
                    }}
                  >
                    đến
                  </span>
                  <input
                    className="hover-input"
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={selectedCorrelationEndDate}
                    onChange={(event) =>
                      setSelectedCorrelationEndDate(event.target.value)
                    }
                    style={{ ...styles.select, minWidth: "200px" }}
                  />
                </div>
              </div>
            </div>

            <div style={styles.kpiGrid(3)}>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Hệ số Tương quan Pearson</span>
                <h3 style={styles.kpiValue}>
                  {correlationStats.pearson == null
                    ? "--"
                    : formatNumber(correlationStats.pearson, 3)}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Thành phần ô nhiễm chủ đạo</span>
                <h3 style={styles.kpiValue}>
                  {correlationStats.dominantComponent ?? "--"}
                </h3>
              </div>
              <div className="hover-card" style={styles.kpiCard}>
                <span style={styles.label}>Tỷ lệ khí thải độc hại</span>
                <h3 style={styles.kpiValue}>
                  {correlationStats.hazardRate == null
                    ? "--"
                    : formatPercent(correlationStats.hazardRate, 1)}
                </h3>
              </div>
            </div>

            <div
              style={{ ...styles.chartGrid, gridTemplateColumns: "1fr 1fr" }}
            >
              <div className="hover-card" style={styles.chartCard}>
                <h3 style={styles.chartTitle}>
                  Biểu đồ Phân tán & Đường Hồi quy
                </h3>
                <div
                  style={{ ...styles.chartPlaceholder, minHeight: "450px" }}
                ></div>
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Radar chart</h3>
                <RadarChart
                  rows={correlationRows}
                  selectedY={selectedCorrelationY}
                  yLabel={
                    CORRELATION_Y_METRICS[selectedCorrelationY]?.label ??
                    selectedCorrelationY
                  }
                  yThreshold={
                    selectedCorrelationY === "us_aqi"
                      ? 100
                      : (CORRELATION_X_METRICS[selectedCorrelationY]
                          ?.threshold ?? 100)
                  }
                  allXMetrics={CORRELATION_X_METRICS}
                  areaLabel={selectedCorrelationProvince || "Toàn quốc"}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
