import React, { useEffect, useMemo, useState } from "react";
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

// --- CÁC HÀM XỬ LÝ DATA (Toán học & Thống kê) ---
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

// --- HÀM HỖ TRỢ LOCAL STORAGE (LƯU CẤU HÌNH MẶC ĐỊNH) ---
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

const Dashboard = () => {
  // Trạng thái Sidebar và Data
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [data, setData] = useState([]);
  const [loadError, setLoadError] = useState("");

  // Load state từ LocalStorage hoặc gán mặc định
  const [activeTab, setActiveTab] = useState(() =>
    getSavedState("activeTab", "overview"),
  );

  // Tab 1 States
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
  const [selectedOverviewHour, setSelectedOverviewHour] = useState(() =>
    getSavedState("selectedOverviewHour", "12"),
  );

  // Tab 2 States
  const [selectedTrendProvince, setSelectedTrendProvince] = useState(() =>
    getSavedState("selectedTrendProvince", ""),
  );
  const [selectedTrendGranularity, setSelectedTrendGranularity] = useState(() =>
    getSavedState("selectedTrendGranularity", "day"),
  );
  const [selectedTrendDate, setSelectedTrendDate] = useState(() =>
    getSavedState("selectedTrendDate", "2026-04-15"),
  );

  // Tab 3 States
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

  // Hàm Lưu Mặc Định (Last Login Style)
  const saveDefaultConfig = () => {
    localStorage.setItem("activeTab", activeTab);
    localStorage.setItem(
      "selectedOverviewProvinces",
      JSON.stringify(selectedOverviewProvinces),
    );
    localStorage.setItem("selectedOverviewMetric", selectedOverviewMetric);
    localStorage.setItem(
      "selectedOverviewStartDate",
      selectedOverviewStartDate,
    );
    localStorage.setItem("selectedOverviewEndDate", selectedOverviewEndDate);
    localStorage.setItem("selectedOverviewHour", selectedOverviewHour);
    localStorage.setItem("selectedTrendProvince", selectedTrendProvince);
    localStorage.setItem("selectedTrendGranularity", selectedTrendGranularity);
    localStorage.setItem("selectedTrendDate", selectedTrendDate);
    localStorage.setItem("selectedCorrelationY", selectedCorrelationY);
    localStorage.setItem("selectedCorrelationX", selectedCorrelationX);
    localStorage.setItem(
      "selectedCorrelationProvince",
      selectedCorrelationProvince,
    );
    localStorage.setItem(
      "selectedCorrelationStartDate",
      selectedCorrelationStartDate,
    );
    localStorage.setItem(
      "selectedCorrelationEndDate",
      selectedCorrelationEndDate,
    );
    alert(
      "✅ Đã cấu hình Dashboard hiện tại làm mặc định cho lần truy cập sau!",
    );
  };

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
        if (!response) throw new Error("CSV not found");
        const text = await response.text();
        const parsed = parseCsv(text);
        if (!cancelled) {
          setData(parsed);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) setLoadError("Không tải được dữ liệu CSV");
      }
    };
    loadCsv();
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
      minHeight: "100vh",
      backgroundColor: theme.bg,
      fontFamily: '"Inter", sans-serif',
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
    },
    mainContent: { flex: 1, padding: "30px 40px", overflowY: "auto" },
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
      gap: "8px",
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
      fontWeight: "800",
      color: theme.textMain,
      marginBottom: "20px",
      textTransform: "uppercase",
    },
  };

  // Logic dữ liệu
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
    const currentDate = parseDateKey(selectedTrendDate);
    const [startDate, endDate] =
      selectedTrendGranularity === "week"
        ? [
            getMonday(selectedTrendDate),
            addDays(getMonday(selectedTrendDate), 6),
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
    selectedTrendDate,
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

  // ICONS
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
  const IconMenu = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );

  return (
    <div style={styles.app}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          .sidebar-container { 
            width: ${isSidebarCollapsed ? "85px" : "280px"}; 
            background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%); 
            display: flex; flex-direction: column; padding: 25px 0; 
            box-shadow: 4px 0 20px rgba(0,0,0,0.15); z-index: 10; 
            transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden; white-space: nowrap;
          }
          .nav-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; padding: 0 12px; }
          .nav-item { 
            padding: 14px ${isSidebarCollapsed ? "0" : "16px"}; border-radius: 12px; cursor: pointer; 
            display: flex; align-items: center; gap: 16px; color: #94A3B8; font-weight: 600; 
            transition: all 0.25s; justify-content: ${isSidebarCollapsed ? "center" : "flex-start"};
          }
          .nav-item.active { background-color: rgba(59, 130, 246, 0.15); color: #FFFFFF; box-shadow: inset 4px 0 0 0 #3B82F6; }
          .nav-text { display: ${isSidebarCollapsed ? "none" : "block"}; font-size: 15px; }
          .nav-item:hover { background-color: rgba(255, 255, 255, 0.1); color: #FFF; }
          .top-header {
            height: 70px; background: #FFF; border-bottom: 1px solid #E2E8F0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .btn-save {
            background: #04216a; color: white; border: none; padding: 10px 18px; border-radius: 10px;
            font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 10px;
            transition: all 0.2s; font-size: 13px; text-transform: uppercase;
          }
          .btn-save:hover { background: #3B82F6; transform: translateY(-1px); }
          .insight-box {
            background: #F8FAFC; border: 1px dashed #3B82F6; border-radius: 16px;
            padding: 20px; marginBottom: 30px; color: #64748B; font-size: 14px;
          }
        `}
      </style>

      {/* --- SIDEBAR --- */}
      <div className="sidebar-container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "45px",
            padding: "0 22px",
          }}
        >
          <img
            src="https://api.dicebear.com/7.x/bottts/svg?seed=AQI_SYSTEM&backgroundColor=3B82F6"
            alt="Logo"
            style={{ width: 40, height: 40, borderRadius: 12 }}
          />
          {!isSidebarCollapsed && (
            <h1
              style={{
                fontSize: "20px",
                fontWeight: "900",
                margin: 0,
                color: "#FFFFFF",
                letterSpacing: "1px",
              }}
            >
              AQI PRO
            </h1>
          )}
        </div>
        <div className="nav-menu">
          <div
            className={
              activeTab === "overview" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveTab("overview")}
          >
            <IconOverview />
            <span className="nav-text">Tổng quan</span>
          </div>
          <div
            className={activeTab === "trend" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("trend")}
          >
            <IconTrend />
            <span className="nav-text">Xu hướng</span>
          </div>
          <div
            className={
              activeTab === "correlation" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActiveTab("correlation")}
          >
            <IconCorrelation />
            <span className="nav-text">Tương quan</span>
          </div>
        </div>
      </div>

      {/* --- MAIN AREA --- */}
      <div style={styles.main}>
        <div className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#0F172A",
              }}
            >
              <IconMenu />
            </button>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "800",
                color: "#0F172A",
                textTransform: "uppercase",
              }}
            >
              {activeTab === "overview"
                ? "Hiện trạng không gian"
                : activeTab === "trend"
                  ? "Phân tích biến động"
                  : "Tương quan chỉ số"}
            </h2>
          </div>
          <button className="btn-save" onClick={saveDefaultConfig}>
            <span>💾</span> Lưu mặc định
          </button>
        </div>

        <div style={styles.mainContent}>
          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === "overview" && (
            <>
              <div style={styles.kpiGrid(4)}>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Trung bình</span>
                  <h3 style={styles.kpiValue}>
                    {overviewStats.average == null
                      ? "--"
                      : formatNumber(
                          overviewStats.average,
                          currentOverviewMetricDecimals,
                        )}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Cao nhất</span>
                  <h3 style={styles.kpiValue}>
                    {overviewStats.max == null
                      ? "--"
                      : formatNumber(
                          overviewStats.max,
                          currentOverviewMetricDecimals,
                        )}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Số tỉnh báo động</span>
                  <h3 style={styles.kpiValue}>
                    {overviewStats.warningProvinces == null
                      ? "--"
                      : overviewStats.warningProvinces}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Vượt chuẩn WHO</span>
                  <h3 style={styles.kpiValue}>
                    {overviewStats.exceedPct == null
                      ? "--"
                      : formatPercent(overviewStats.exceedPct, 1)}
                  </h3>
                </div>
              </div>

              {/* [CHỖ CHÈN INSIGHT TAB 1] */}
              <div className="insight-box" style={{ marginBottom: "30px" }}>
                <h4
                  style={{
                    margin: "0 0 10px 0",
                    color: "#3B82F6",
                    fontWeight: "800",
                  }}
                >
                  💡 INSIGHT TỔNG QUAN
                </h4>
                <p style={{ margin: 0 }}>
                  Dữ liệu ghi nhận mức độ ô nhiễm trung bình toàn quốc trong
                  tháng 4/2026. Các tỉnh phía Bắc có xu hướng chỉ số cao hơn...
                </p>
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
                  <h3 style={styles.chartTitle}>Top 8 Ô nhiễm nhất</h3>
                  <HorizontalBarChart
                    rows={overviewRows}
                    metricKey={selectedOverviewMetric}
                    metricLabel={currentOverviewMetricLabel}
                    topN={8}
                    order="desc"
                    barColor="#EF4444"
                  />
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>Top 8 Trong lành nhất</h3>
                  <HorizontalBarChart
                    rows={overviewRows}
                    metricKey={selectedOverviewMetric}
                    metricLabel={currentOverviewMetricLabel}
                    topN={8}
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

              <div style={styles.kpiGrid(6)}>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>TB Kỳ</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "20px" }}>
                    {trendStats.average == null
                      ? "--"
                      : formatNumber(trendStats.average, 0)}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Ngày vượt</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "20px" }}>
                    {trendStats.exceedDays}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Biến động</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "20px" }}>
                    {formatPercent(trendStats.volatility, 1)}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Cao/Thấp</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "16px" }}>
                    {formatNumber(trendStats.max, 0)} /{" "}
                    {formatNumber(trendStats.min, 0)}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Dự báo đỉnh</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "20px" }}>
                    {formatNumber(trendStats.forecastPeak, 0)}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Giờ rủi ro</span>
                  <h3 style={{ ...styles.kpiValue, fontSize: "20px" }}>
                    {trendStats.riskHours}
                  </h3>
                </div>
              </div>

              {/* [CHỖ CHÈN INSIGHT TAB 2] */}
              <div className="insight-box" style={{ marginBottom: "30px" }}>
                <h4
                  style={{
                    margin: "0 0 10px 0",
                    color: "#3B82F6",
                    fontWeight: "800",
                  }}
                >
                  💡 INSIGHT BIẾN ĐỘNG
                </h4>
                <p style={{ margin: 0 }}>
                  Xu hướng chỉ số có dấu hiệu tăng mạnh vào các khung giờ cao
                  điểm (7h-9h). Dự báo trong 24h tới...
                </p>
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

              <div style={styles.kpiGrid(2)}>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Hệ số tương quan Pearson</span>
                  <h3 style={styles.kpiValue}>
                    {correlationStats.pearson == null
                      ? "--"
                      : formatNumber(correlationStats.pearson, 3)}
                  </h3>
                </div>
                <div className="hover-card" style={styles.kpiCard}>
                  <span style={styles.label}>Thành phần chính gây ô nhiễm</span>
                  <h3 style={styles.kpiValue}>
                    {correlationStats.dominantComponent ?? "--"}
                  </h3>
                </div>
              </div>

              {/* [CHỖ CHÈN INSIGHT TAB 3] */}
              <div className="insight-box" style={{ marginBottom: "30px" }}>
                <h4
                  style={{
                    margin: "0 0 10px 0",
                    color: "#3B82F6",
                    fontWeight: "800",
                  }}
                >
                  💡 INSIGHT TƯƠNG QUAN
                </h4>
                <p style={{ margin: 0 }}>
                  Kết quả cho thấy mối liên hệ mật thiết giữa nồng độ CO và AQI
                  tại các khu vực đô thị lớn...
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "25px",
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
                    xLabel={CORRELATION_X_METRICS[selectedCorrelationX]?.label}
                    yKey={selectedCorrelationY}
                    yLabel={CORRELATION_Y_METRICS[selectedCorrelationY]?.label}
                  />
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>Cấu trúc khí thải (Radar)</h3>
                  <RadarChart
                    rows={correlationRows}
                    selectedY={selectedCorrelationY}
                    yLabel={CORRELATION_Y_METRICS[selectedCorrelationY]?.label}
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
  );
};

export default Dashboard;
