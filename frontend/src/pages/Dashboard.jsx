import React, { useEffect, useMemo, useState } from "react";
import { useGemini } from '../hooks/useGemini';
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
  // Trạng thái Data
  const [data, setData] = useState([]);
  const [loadError, setLoadError] = useState("");

  // Dữ liệu dự báo từ API
  const [forecastData, setForecastData] = useState([]);

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
  // Ngày được chọn tạm thời từ Heatmap (nếu có sẽ ghi đè lên selectedTrendDate)
  const [heatmapSelectedDate, setHeatmapSelectedDate] = useState("");

  const effectiveTrendDate = heatmapSelectedDate || selectedTrendDate;

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

  useEffect(() => {
    let cancelled = false;
    const loadDataFromApi = async () => {
      try {
        const response = await fetch("/api/air-quality/all");
        if (!response.ok) throw new Error("API error: " + response.statusText);
        const parsed = await response.json();
        
        if (!cancelled) {
          setData(parsed);
          setLoadError("");

          // Tìm ngày mới nhất để set mặc định cho Tab Tổng quan
          if (parsed.length > 0) {
            const maxDate = parsed.reduce((max, row) =>
              row.dateKey > max ? row.dateKey : max, parsed[0].dateKey
            );
            setSelectedOverviewStartDate(maxDate);
            setSelectedOverviewEndDate(maxDate);
          }
        }
      } catch (error) {
        if (!cancelled) setLoadError("Không tải được dữ liệu từ API");
      }
    };

    const loadForecast = async () => {
      try {
        const response = await fetch("/api/air-quality/forecast");
        if (response.ok) {
          const res = await response.json();
          if (!cancelled && res.success) {
            setForecastData(res.data);
          }
        }
      } catch (err) {
        console.error("Lỗi tải dự báo:", err);
      }
    };

    loadDataFromApi();
    loadForecast();

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
      zIndex: 9999,
    },
    topbarLogo: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
    },
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
    topbarActions: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    body: {
      display: "flex",
      flex: 1,
      minHeight: 0,
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      marginLeft: "110px",
    },
    mainContent: { flex: 1, padding: "20px 40px", overflowY: "auto" },
    filterSection: {
      display: "flex",
      gap: "20px",
      marginBottom: "15px",
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
      marginBottom: "15px",
    }),
    kpiCard: {
      backgroundColor: theme.card,
      padding: "16px",
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
      padding: "16px",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
      border: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
    },
    chartTitle: {
      fontSize: "16px",
      fontWeight: "800",
      color: theme.textMain,
      marginBottom: "12px",
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
  // === GEMINI AI ENGINE ===
  const { generateInsight, loadingAI } = useGemini();
  const [insightT1, setInsightT1] = useState("");
  const [insightT2, setInsightT2] = useState("Bấm 'Phân tích' để bắt đầu.");
  const [insightT3, setInsightT3] = useState("Bấm 'Phân tích' để bắt đầu.");

  // Tự động phân tích Tab 1 khi dữ liệu thay đổi
  useEffect(() => {
    if (activeTab === 'overview' && overviewRows.length > 0 && !insightT1 && !loadingAI) {
      handleCallAI('overview');
    }
  }, [activeTab, overviewRows, insightT1, loadingAI]);

  // Reset insight T1 khi filter thay đổi để trigger tự động phân tích lại
  useEffect(() => {
    setInsightT1("");
  }, [selectedOverviewProvinces, selectedOverviewStartDate, selectedOverviewEndDate, selectedOverviewMetric]);

  // Hàm gọi AI chung
  const handleCallAI = async (tab) => {
    if (tab === 'overview') {
      const provinceGroups = {};
      overviewRows.forEach(row => {
        if (!provinceGroups[row.province]) provinceGroups[row.province] = { totalAqi: 0, count: 0 };
        provinceGroups[row.province].totalAqi += row.us_aqi;
        provinceGroups[row.province].count += 1;
      });
      const aggregatedList = Object.keys(provinceGroups).map(prov => ({
        province: prov,
        avg_aqi: provinceGroups[prov].totalAqi / provinceGroups[prov].count
      })).sort((a, b) => b.avg_aqi - a.avg_aqi);

      const payloadT1 = {
        trung_binh_chung: overviewStats.average?.toFixed(1) || "0",
        so_tinh_vuot_nguong: overviewStats.warningProvinces || 0,
        top_3_o_nhiem: aggregatedList.slice(0, 3).map(r => r.province),
        top_3_trong_lanh: [...aggregatedList].reverse().slice(0, 3).map(r => r.province)
      };
      const result = await generateInsight(payloadT1);
      setInsightT1(result);
    }
    else if (tab === 'trend') {
      const payloadT2 = {
        average: trendStats.average?.toFixed(1),
        max: trendStats.max,
        min: trendStats.min,
        exceedDays: trendStats.exceedDays,
        volatility: trendStats.volatility?.toFixed(1) + "%",
        riskHours: trendStats.riskHours
      };
      const result = await generateInsight(payloadT2);
      setInsightT2(result);
    }
    else if (tab === 'correlation') {
      const payloadT3 = {
        bien_Y: CORRELATION_Y_METRICS[selectedCorrelationY]?.label,
        bien_X: CORRELATION_X_METRICS[selectedCorrelationX]?.label,
        he_so_Pearson: correlationStats.pearson?.toFixed(2),
        thanh_phan_chu_dao: correlationStats.dominantComponent
      };
      const result = await generateInsight(payloadT3);
      setInsightT3(result);
    }
  };
  // ==========================
  return (
    <div style={styles.app}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          .sidebar-rail {
            width: 80px;
            height: auto;
            max-height: 80vh;
            background: rgba(17, 28, 68, 0.9) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 35px;
            position: fixed;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            padding: 25px 0;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            overflow: hidden;
          }
          .sidebar-rail:hover {
            width: 260px;
            border-radius: 25px;
          }
          .nav-rail-btn {
            width: 54px;
            height: 54px;
            border-radius: 18px;
            border: none;
            background: transparent;
            color: #94A3B8;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-left: 17px;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            margin: 8px auto;
            flex-shrink: 0;
            overflow: hidden;
            white-space: nowrap;
          }
          .sidebar-rail:hover .nav-rail-btn {
            width: 220px;
            justify-content: flex-start;
            padding: 0 20px;
            margin: 6px 20px;
          }
          .nav-rail-btn.active {
            background: #4318FF;
            color: #FFFFFF;
            box-shadow: 0 10px 20px rgba(67, 24, 255, 0.3);
          }
          .nav-rail-btn:hover:not(.active) {
            background: rgba(255, 255, 255, 0.1);
            color: #FFFFFF;
          }
          .nav-rail-label {
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease;
            transform: translateX(-10px);
            margin-left: 15px;
            font-weight: 600;
            font-size: 14px;
            pointer-events: none;
          }
          .sidebar-rail:hover .nav-rail-label {
            opacity: 1;
            transform: translateX(0);
            transition-delay: 0.1s;
            pointer-events: auto;
          }
          .nav-rail-icon {
            font-size: 20px;
            flex-shrink: 0;
            transition: transform 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .sidebar-rail:hover .nav-rail-icon {
            transform: scale(1.1);
          }
          .topbar-btn {
            display: flex; align-items: center; gap: 8px;
            padding: 9px 18px;
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.25);
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
            font-family: inherit;
          }
          .topbar-btn:hover { background: rgba(255,255,255,0.2); }
          .topbar-pill-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 18px;
            border-radius: 30px;
            border: 1px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.05);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            cursor: pointer;
            transition: all 0.2s;
          }
          .topbar-pill-btn:hover {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.4);
          }
          .insight-box {
            background: #F8FAFC; border: 1px dashed #3B82F6; border-radius: 16px;
            padding: 20px; marginBottom: 30px; color: #64748B; font-size: 14px;
          }
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
        {/* NAVIGATION RAIL */}
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                    gap: "20px",
                    marginBottom: "30px",
                  }}
                >
                  {(() => {
                    const avg = overviewStats.average;
                    let sLabel = "--";
                    let sColor = "#333";
                    if (avg != null) {
                      if (avg <= 50) {
                        sLabel = "Tốt";
                        sColor = "#00C853";
                      } else if (avg <= 100) {
                        sLabel = "Vừa";
                        sColor = "#FFD600";
                      } else if (avg <= 150) {
                        sLabel = "Nhạy cảm";
                        sColor = "#E54B4B";
                      } else if (avg <= 200) {
                        sLabel = "Xấu";
                        sColor = "#D50000";
                      } else {
                        sLabel = "Rất xấu";
                        sColor = "#B71C1C";
                      }
                    }
                    return (
                      <div
                        className="hover-card"
                        style={{
                          ...styles.kpiCard,
                          borderLeft: `4px solid ${sColor}`,
                          padding: "16px 20px",
                        }}
                      >
                        <span style={{ ...styles.label, fontSize: "12px" }}>
                          AQI TRUNG BÌNH
                        </span>
                        <h3
                          style={{
                            ...styles.kpiValue,
                            color: sColor,
                            fontSize: "32px",
                            marginTop: "4px",
                            lineHeight: "1",
                          }}
                        >
                          {avg == null
                            ? "--"
                            : formatNumber(avg, currentOverviewMetricDecimals)}
                        </h3>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: sColor,
                            marginTop: "6px",
                          }}
                        >
                          {sLabel}
                        </div>
                      </div>
                    );
                  })()}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      justifyContent: "center",
                      padding: "16px 20px",
                    }}
                  >
                    <span style={{ ...styles.label, fontSize: "12px" }}>
                      CAO NHẤT
                    </span>
                    <h3
                      style={{
                        ...styles.kpiValue,
                        fontSize: "24px",
                        marginTop: "4px",
                      }}
                    >
                      {overviewStats.max == null
                        ? "--"
                        : formatNumber(
                          overviewStats.max,
                          currentOverviewMetricDecimals,
                        )}
                    </h3>
                  </div>
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      justifyContent: "center",
                      padding: "16px 20px",
                    }}
                  >
                    <span style={{ ...styles.label, fontSize: "12px" }}>
                      SỐ TỈNH
                    </span>
                    <h3
                      style={{
                        ...styles.kpiValue,
                        fontSize: "24px",
                        marginTop: "4px",
                      }}
                    >
                      {overviewStats.warningProvinces == null
                        ? "--"
                        : overviewStats.warningProvinces}
                    </h3>
                  </div>
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      justifyContent: "center",
                      padding: "16px 20px",
                    }}
                  >
                    <span style={{ ...styles.label, fontSize: "12px" }}>
                      VƯỢT WHO
                    </span>
                    <h3
                      style={{
                        ...styles.kpiValue,
                        fontSize: "24px",
                        marginTop: "4px",
                      }}
                    >
                      {overviewStats.exceedPct == null
                        ? "--"
                        : formatPercent(overviewStats.exceedPct, 1)}
                    </h3>
                  </div>
                </div>

                {/* [CHỖ CHÈN INSIGHT TAB 1] */}
                {/* INSIGHT TAB 1 */}
                <div className="insight-box" style={{ marginBottom: "15px", background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px' }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#0F172A", fontWeight: "800", display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    <span style={{ fontSize: '16px' }}>✨</span> AI INSIGHT TỔNG QUAN
                    {loadingAI && <span style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 'bold' }}> (Đang phân tích...)</span>}
                  </h4>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#475569', fontSize: '13px', lineHeight: '1.5' }}>
                    {insightT1 || "Đang quét dữ liệu..."}
                  </pre>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr",
                    gap: "15px",
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

                <div style={styles.kpiGrid(6)}>
                  {/* Metric 1: TB Kỳ */}
                  <div className="hover-card" style={styles.kpiCard}>
                    <span style={styles.label}>TB KỲ</span>
                    <h3 style={{ ...styles.kpiValue, fontSize: "22px", marginTop: "8px" }}>
                      {trendStats.average == null
                        ? "--"
                        : formatNumber(trendStats.average, 0)}
                    </h3>
                  </div>

                  {/* Metric 2: Ngày vượt */}
                  <div className="hover-card" style={styles.kpiCard}>
                    <span style={styles.label}>NGÀY VƯỢT</span>
                    <h3 style={{ ...styles.kpiValue, fontSize: "22px", marginTop: "8px" }}>
                      {trendStats.exceedDays}
                    </h3>
                  </div>

                  {/* Metric 3: Biến động */}
                  <div className="hover-card" style={styles.kpiCard}>
                    <span style={styles.label}>BIẾN ĐỘNG</span>
                    <h3 style={{ ...styles.kpiValue, fontSize: "22px", marginTop: "8px" }}>
                      {formatPercent(trendStats.volatility, 1)}
                    </h3>
                  </div>

                  {/* Metric 4: CAO / THẤP (Premium) */}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          ...styles.label,
                          fontSize: "11px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        CAO / THẤP
                      </span>
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#F1F5F9",
                          borderRadius: "8px",
                          color: "#64748B",
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
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
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "6px",
                        marginTop: "8px",
                      }}
                    >
                      <h3 style={{ ...styles.kpiValue, fontSize: "22px" }}>
                        {formatNumber(trendStats.max, 0)}
                      </h3>
                      <span
                        style={{
                          color: "#94A3B8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        / {formatNumber(trendStats.min, 0)}
                      </span>
                    </div>
                  </div>

                  {/* Metric 5: Dự báo đỉnh (Premium) */}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          ...styles.label,
                          fontSize: "11px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        DỰ BÁO ĐỈNH
                      </span>
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#FFFBEB",
                          borderRadius: "8px",
                          color: "#D97706",
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
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
                      </div>
                    </div>
                    <h3
                      style={{
                        ...styles.kpiValue,
                        fontSize: "22px",
                        marginTop: "8px",
                      }}
                    >
                      {formatNumber(trendStats.forecastPeak, 0)}
                    </h3>
                  </div>

                  {/* Metric 6: Giờ rủi ro (Premium) */}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          ...styles.label,
                          fontSize: "11px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        GIỜ RỦI RO
                      </span>
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#F3E8FF",
                          borderRadius: "8px",
                          color: "#9333EA",
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
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
                      </div>
                    </div>
                    <h3
                      style={{
                        ...styles.kpiValue,
                        fontSize: "22px",
                        marginTop: "8px",
                      }}
                    >
                      {trendStats.riskHours}
                    </h3>
                  </div>
                </div>
                {/* [CHỖ CHÈN INSIGHT TAB 2] */}
                {/* INSIGHT TAB 2 */}
                <div className="insight-box" style={{ marginBottom: "30px", background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: "#0F172A", fontWeight: "800", display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>✨</span> AI INSIGHT XU HƯỚNG
                    </h4>
                    <button onClick={() => handleCallAI('trend')} disabled={loadingAI} style={{ padding: '8px 16px', background: loadingAI ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: loadingAI ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                      {loadingAI ? "Đang quét..." : "Phân tích xu hướng"}
                    </button>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
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
                        data={data}
                        province={selectedTrendProvince}
                        selectedDate={effectiveTrendDate}
                        onDateSelect={setHeatmapSelectedDate}
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    marginBottom: "30px",
                  }}
                >
                  {/* Hero Metric 1: Pearson */}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          ...styles.label,
                          fontSize: "12px",
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Hệ số tương quan Pearson
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "12px",
                          marginTop: "8px",
                        }}
                      >
                        <h3
                          style={{
                            ...styles.kpiValue,
                            fontSize: "36px",
                            lineHeight: "1",
                            color: "#0F172A",
                          }}
                        >
                          {correlationStats.pearson == null
                            ? "--"
                            : formatNumber(correlationStats.pearson, 3)}
                        </h3>
                        {correlationStats.pearson != null && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: "#EFF6FF",
                              color: "#2563EB",
                            }}
                          >
                            R² Score
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: "#EFF6FF",
                        color: "#3B82F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
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
                    </div>
                  </div>

                  {/* Hero Metric 2: Thành phần chính */}
                  <div
                    className="hover-card"
                    style={{
                      ...styles.kpiCard,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          ...styles.label,
                          fontSize: "12px",
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Thành phần chính gây ô nhiễm
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "12px",
                          marginTop: "8px",
                        }}
                      >
                        <h3
                          style={{
                            ...styles.kpiValue,
                            fontSize: "36px",
                            lineHeight: "1",
                            color: "#0F172A",
                          }}
                        >
                          {correlationStats.dominantComponent ?? "--"}
                        </h3>
                        {correlationStats.dominantComponent && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: "#FFF7ED",
                              color: "#EA580C",
                            }}
                          >
                            Chủ đạo
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: "#FFF7ED",
                        color: "#F97316",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* [CHỖ CHÈN INSIGHT TAB 3] */}
                {/* INSIGHT TAB 3 */}
                <div className="insight-box" style={{ marginBottom: "30px", background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: "#0F172A", fontWeight: "800", display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>✨</span> AI INSIGHT TƯƠNG QUAN
                    </h4>
                    <button onClick={() => handleCallAI('correlation')} disabled={loadingAI} style={{ padding: '8px 16px', background: loadingAI ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: loadingAI ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                      {loadingAI ? "Đang quét..." : "Phân tích tương quan"}
                    </button>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
                    {insightT3}
                  </pre>
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
