import React, { useEffect, useMemo, useState } from "react";
import ProvinceSelector from "./ProvinceSelector";
import TimeSeriesLineChart from "../components/TimeSeriesLineChart";
import RadarChart from "../components/RadarChart";
import CalendarHeatmap from "../components/CalendarHeatmap";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // === AQI COLOR SYSTEM (US Standard — học từ repo tham khảo) ===
  const AQI_LEVELS = [
    { max: 50,  label: "Tốt",        color: "#00C853", bg: "rgba(0,200,83,0.1)" },
    { max: 100, label: "Vừa phải",   color: "#FFD600", bg: "rgba(255,214,0,0.1)" },
    { max: 150, label: "Nhạy cảm",   color: "#FF6D00", bg: "rgba(255,109,0,0.1)" },
    { max: 200, label: "Không khỏe", color: "#D50000", bg: "rgba(213,0,0,0.1)" },
    { max: 300, label: "Rất xấu",    color: "#6A1B9A", bg: "rgba(106,27,154,0.1)" },
    { max: 999, label: "Nguy hiểm",  color: "#4E342E", bg: "rgba(78,52,46,0.1)" },
  ];

  const getAqiLevel = (aqi) => AQI_LEVELS.find(l => aqi <= l.max) || AQI_LEVELS[5];

  const POLLUTANTS = [
    { key: "pm2_5",           label: "PM2.5",  unit: "μg/m³", threshold: 15 },
    { key: "pm10",            label: "PM10",   unit: "μg/m³", threshold: 45 },
    { key: "carbon_monoxide", label: "CO",     unit: "μg/m³", threshold: 4000 },
    { key: "sulphur_dioxide", label: "SO2",    unit: "μg/m³", threshold: 40 },
    { key: "nitrogen_dioxide",label: "NO2",    unit: "μg/m³", threshold: 25 },
    { key: "ozone",           label: "O3",     unit: "μg/m³", threshold: 100 },
  ];

  const theme = {
    bg: "var(--bg-main)",
    sidebar: "var(--bg-sidebar)",
    card: "var(--bg-surface)",
    textMain: "var(--text-main)",
    textSub: "var(--text-sub)",
    accent: "var(--accent)",
    border: "var(--border-light)",
    headerBg: "var(--bg-sidebar)",
  };

  const styles = {
    app: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      backgroundColor: theme.bg,
      fontFamily: '"Montserrat", sans-serif',
      color: theme.textMain,
    },
    topbar: {
      background: theme.headerBg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 40px",
      height: "70px",
      flexShrink: 0,
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
      position: "sticky",
      top: 0,
      zIndex: 100,
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
    sidebar: {
      display: "none", // Will use CSS positioning instead
    },
    main: { 
      flex: 1, 
      padding: "36px 48px", 
      overflowY: "auto",
    },
    header: {
      fontSize: "28px",
      fontWeight: "700",
      color: theme.textMain,
      marginBottom: "8px",
      letterSpacing: "-0.02em",
    },
    filterSection: {
      display: "flex",
      gap: "20px",
      marginBottom: "30px",
      flexWrap: "wrap",
    },
    filterBox: { display: "flex", flexDirection: "column", gap: "8px" },
    label: {
      fontSize: "11px",
      fontWeight: "700",
      color: theme.textSub,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
    select: {
      padding: "12px 16px",
      borderRadius: "14px",
      border: "1px solid #E0E5F2",
      backgroundColor: theme.card,
      fontSize: "14px",
      color: theme.textMain,
      minWidth: "220px",
      outline: "none",
      fontWeight: "600",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      cursor: "pointer",
    },
    radioGroup: {
      display: "flex",
      gap: "16px",
      alignItems: "center",
      height: "46px",
      flexWrap: "wrap",
      backgroundColor: theme.card,
      padding: "0 18px",
      borderRadius: "14px",
      border: "1px solid #E0E5F2",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    radioLabel: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      fontWeight: "600",
      color: theme.textMain,
      cursor: "pointer",
    },
    kpiGrid: (cols) => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "20px",
      marginBottom: "28px",
    }),
    kpiCard: {
      backgroundColor: "#111C44",
      padding: "16px 20px",
      borderRadius: "16px",
      boxShadow: "0px 8px 24px rgba(0,0,0,0.12)",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      border: "1px solid rgba(255,255,255,0.08)",
      position: "relative",
      overflow: "hidden",
    },
    kpiValue: {
      fontSize: "26px",
      fontWeight: "800",
      color: "#FFFFFF",
      margin: 0,
      letterSpacing: "-1px",
      lineHeight: 1,
    },
    chartGrid: { display: "grid", gap: "24px" },
    chartCard: {
      backgroundColor: theme.card,
      borderRadius: "20px",
      padding: "28px",
      boxShadow: "0px 14px 30px rgba(112,144,176,0.10)",
      border: "none",
      display: "flex",
      flexDirection: "column",
    },
    chartTitle: {
      fontSize: "17px",
      fontWeight: "700",
      color: theme.textMain,
      marginBottom: "22px",
      letterSpacing: "-0.02em",
    },
    chartTitleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "22px",
    },
    chartBadge: {
      fontSize: "10px",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      padding: "4px 12px",
      borderRadius: "30px",
      backgroundColor: "rgba(67,24,255,0.08)",
      color: "#4318FF",
    },
    chartPlaceholder: {
      flex: 1,
      borderRadius: "14px",
      backgroundColor: "#F1F5F9",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "300px",
      gap: "12px",
      position: "relative",
      overflow: "hidden",
    },
    kpiIcon: {
      width: "44px",
      height: "44px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      marginBottom: "4px",
    },
    kpiSubtext: {
      fontSize: "13px",
      color: theme.textSub,
      fontWeight: "500",
      margin: 0,
    },
    // === POLLUTANT CARD (học từ repo tham khảo) ===
    pollutantCard: {
      backgroundColor: "#111C44",
      borderRadius: "14px",
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "0px 8px 24px rgba(0,0,0,0.12)",
      border: "1px solid rgba(255,255,255,0.08)",
      gap: "12px",
    },
    pollutantValue: {
      fontSize: "22px",
      fontWeight: "800",
      color: "#FFFFFF",
      margin: 0,
      letterSpacing: "-0.5px",
    },
    pollutantUnit: {
      fontSize: "12px",
      color: "#FFFFFF",
      fontWeight: "500",
      marginTop: "2px",
    },
    // === AQI STATUS BADGE (học từ repo tham khảo) ===
    aqiBadge: (color) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 12px",
      borderRadius: "30px",
      fontSize: "12px",
      fontWeight: "700",
      backgroundColor: color + "20",
      color: color,
      border: `1px solid ${color}40`,
    }),
    // === DELTA INDICATOR (học từ repo tham khảo) ===
    deltaUp: {
      fontSize: "13px",
      fontWeight: "700",
      color: "#E53E3E",
      display: "flex",
      alignItems: "center",
      gap: "3px",
    },
    deltaDown: {
      fontSize: "13px",
      fontWeight: "700",
      color: "#38A169",
      display: "flex",
      alignItems: "center",
      gap: "3px",
    },
    // === SECTION LABEL (học từ repo tham khảo) ===
    sectionLabel: {
      fontSize: "10px",
      fontWeight: "800",
      color: theme.accent,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: "6px",
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

  const overviewRows = useMemo(() => {
    if (!data.length) return [];
    const selectedSet = new Set(selectedOverviewProvinces);
    const useAllProvinces = selectedSet.size === 0;

    return data.filter(
      (row) =>
        row.dateKey >= selectedOverviewStartDate &&
        row.dateKey <= selectedOverviewEndDate &&
        (useAllProvinces || selectedSet.has(row.province)),
    );
  }, [
    data,
    selectedOverviewProvinces,
    selectedOverviewStartDate,
    selectedOverviewEndDate,
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

  const histogramData = useMemo(() => {
    if (!trendAqiValues.length) return [];
    const bins = [
      { name: "Tốt (0-50)", count: 0, color: "#10B981", min: 0, max: 50 },
      { name: "TB (51-100)", count: 0, color: "#F59E0B", min: 51, max: 100 },
      { name: "Kém (101-150)", count: 0, color: "#F97316", min: 101, max: 150 },
      { name: "Xấu (151-200)", count: 0, color: "#EF4444", min: 151, max: 200 },
      { name: "Rất xấu (201-300)", count: 0, color: "#8B5CF6", min: 201, max: 300 },
      { name: "Nguy hại (>300)", count: 0, color: "#7F1D1D", min: 301, max: Infinity },
    ];

    trendAqiValues.forEach((val) => {
      const targetBin = bins.find((b) => val >= b.min && val <= b.max);
      if (targetBin) targetBin.count += 1;
    });

    return bins.filter((b) => b.count > 0);
  }, [trendAqiValues]);

  const currentOverviewMetricLabel = OVERVIEW_METRICS[selectedOverviewMetric]?.label || selectedOverviewMetric;
  const currentOverviewMetricDecimals = OVERVIEW_METRICS[selectedOverviewMetric]?.decimals || 0;

  const correlationRows = useMemo(() => {
    if (!data.length) return [];

    return data.filter((row) => {
      const provinceMatch =
        !selectedCorrelationProvince ||
        row.province === selectedCorrelationProvince;
      // Lọc dữ liệu nằm trong khoảng từ ngày bắt đầu đến ngày kết thúc
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


  return (
    <div style={styles.app}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

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
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            margin: 8px auto;
            flex-shrink: 0;
            padding: 0;
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
          }
          .sidebar-rail:hover .nav-rail-icon {
            transform: scale(1.1);
          }
          .main-content {
            flex: 1;
            margin-left: 110px;
            min-width: 0;
            background-color: var(--bg-main);
            padding: 36px 48px;
          }

          /* === HIỆU ỨNG SIDEBAR (Nâng cấp) === */
          .nav-item:hover { 
            background-color: rgba(255, 255, 255, 0.1); 
            color: #FFFFFF; 
            transform: translateX(8px); 
            box-shadow: -4px 0 15px rgba(59, 130, 246, 0.2); 
          }

          /* === CARD HOVER === */
          .hover-card {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
          }
          .hover-card:hover {
            transform: translateY(-4px);
            box-shadow: 0px 22px 45px rgba(112, 144, 176, 0.18) !important;
          }

          /* === TOPBAR BUTTONS === */
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
          .dot-icon {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #FFFFFF;
            display: inline-block;
          }
          .hover-input:focus { border-color: #4318FF !important; box-shadow: 0 0 0 4px rgba(67,24,255,0.15) !important; outline: none; }

          /* === SKELETON ANIMATION === */
          @keyframes skeleton-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .skeleton-line {
            border-radius: 8px;
            background: linear-gradient(90deg, #E0E5F2 25%, #EEF2FB 50%, #E0E5F2 75%);
            background-size: 200% 100%;
            animation: skeleton-shimmer 1.5s infinite;
          }
          @keyframes skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .placeholder-icon {
            font-size: 40px;
            opacity: 0.25;
          }
          .placeholder-text {
            font-size: 14px;
            font-weight: 600;
            color: #A3AED0;
            letter-spacing: 0.02em;
          }

          /* === STICKY FILTER BAR === */
          .filter-bar-sticky {
            position: sticky;
            top: 0;
            z-index: 20;
            background: rgba(244, 247, 254, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            margin: 0 -60px 35px -60px;
            padding: 20px 60px;
            border-bottom: 1px solid rgba(67, 24, 255, 0.08);
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
            align-items: flex-end;
          }

          /* === RESPONSIVE KPI GRID === */
          .kpi-responsive {
            display: grid;
            gap: 16px;
            margin-bottom: 28px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }

          /* === KPI CARD ACCENT LINE === */
          .kpi-accent-bar {
            height: 4px;
            border-radius: 2px;
            margin-bottom: 20px;
          }

          /* === PAGE HEADER STYLING === */
          .page-header-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 35px;
          }
          .page-header-sub {
            font-size: 14px;
            font-weight: 500;
            color: #A3AED0;
            margin-top: 6px;
          }
          /* === NAV RAIL (icon sidebar) === */
          .nav-rail-btn {
            width: 52px; height: 52px;
            border-radius: 16px;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 4px;
            cursor: pointer;
            position: relative;
            transition: all 0.3s ease;
            color: rgba(255,255,255,0.55);
            font-size: 22px;
            border: none; background: transparent;
            white-space: nowrap;
          }
          .nav-rail-btn.expanded {
            width: calc(100% - 24px);
            height: 48px;
            flex-direction: row;
            justify-content: flex-start;
            padding-left: 20px;
            gap: 12px;
            border-radius: 12px;
            margin: 0 12px;
          }
          .nav-rail-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
          .nav-rail-btn.active { background: rgba(255,255,255,0.18); color: #fff; }
          .nav-rail-btn.active::before {
            content: '';
            position: absolute; left: 0; top: 50%;
            transform: translateY(-50%);
            width: 4px; height: 28px;
            background: #4318FF;
            border-radius: 0 4px 4px 0;
          }
          .nav-rail-label {
            font-size: 9px; font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: inherit;
            line-height: 1;
            transition: all 0.3s ease;
          }
          .nav-rail-label.expanded {
            font-size: 13px !important;
            text-transform: none;
            letter-spacing: normal;
            font-weight: 600;
          }
          .nav-rail-sep { height: 1px; width: 40px; background: rgba(255,255,255,0.1); margin: 8px 0; }

          /* === TOPBAR BTN === */
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

          /* === POLLUTANT GRID (học từ repo tham khảo) === */
          .pollutant-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }
          @media (max-width: 1200px) { .pollutant-grid { grid-template-columns: repeat(2,1fr); } }

          /* === AQI LEGEND === */
          .aqi-legend { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .aqi-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; }
          .aqi-dot { width: 10px; height: 10px; border-radius: 50%; }
        `}
      </style>

      {/* === TOPBAR === */}
      <div style={styles.topbar}>
        <div style={styles.topbarLogo}>
          {!isSidebarOpen && (
            <button className="topbar-btn" onClick={() => setIsSidebarOpen(true)} style={{padding:"8px 12px", marginRight:"12px"}} title="Mở menu">
              <span style={{fontSize:"18px", lineHeight:1}}>☰</span>
            </button>
          )}
          <div>
            <p style={styles.topbarTitle}>Phân tích Chỉ số Chất lượng Không khí Việt Nam</p>
            <p style={styles.topbarSub}>GVHD: Lê Hoàng Anh • KHTN • HCMUS • Năm 2025–2026</p>
          </div>
        </div>
        <div style={styles.topbarActions}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"11px",fontWeight:"700",color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>AQI HIỆN TẠI:</span>
            {[{max:50,lbl:"Tốt",c:"#00C853"},{max:100,lbl:"Vừa",c:"#FFD600"},{max:150,lbl:"Nhạy cảm",c:"#FF6D00"},{max:200,lbl:"Xấu",c:"#D50000"}].map(({lbl,c})=>(
              <span key={lbl} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",fontWeight:"700",color:"rgba(255,255,255,0.8)"}}>
                <span style={{width:"9px",height:"9px",borderRadius:"50%",backgroundColor:c,display:"inline-block"}}/>{lbl}
              </span>
            ))}
          </div>
          <button className="topbar-pill-btn">
            <span style={{fontSize:"14px"}}>↻</span> Làm mới
          </button>
        </div>
      </div>

      {/* === BODY = RAIL + MAIN === */}
      <div style={styles.body}>
        {/* NAVIGATION RAIL (icon-only, học từ repo tham khảo) */}
        <div className="sidebar-rail">
          {[
            {tab:"overview",  label:"Tổng quan", icon: "📊"},
            {tab:"trend",     label:"Xu hướng", icon: "📈"},
            {tab:"correlation",label:"Tương quan", icon: "🔗"},
          ].map(({tab,label,icon}) => (
            <button
              key={tab}
              className={`nav-rail-btn${activeTab===tab?" active":""}`}
              onClick={()=>setActiveTab(tab)}
              title={label}
            >
              <span className="nav-rail-icon">{icon}</span>
              <span className="nav-rail-label">
                {label}
              </span>
            </button>
          ))}
        </div>

        <div style={styles.main} className="main-content">
          {loadError && (
            <div style={{marginBottom:"20px",color:"#DC2626",fontWeight:600}}>{loadError}</div>
          )}

        {activeTab === "overview" && (
          <>
            {/* PAGE HEADER */}
            <div className="page-header-row">
              <div>
                <h2 style={styles.header}>Tổng quan Chất lượng Không khí</h2>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", fontWeight:"600", color:"#4318FF", background:"rgba(67,24,255,0.08)", padding:"8px 16px", borderRadius:"30px"}}>
                <span style={{width:"8px",height:"8px",borderRadius:"50%",backgroundColor:"#00C853"}}></span> Đang cập nhật
              </div>
            </div>

            {/* STICKY FILTER BAR */}
            <div className="filter-bar-sticky">
              <div style={styles.filterBox}>
                <span style={styles.label}>Tỉnh/thành</span>
                <div className="hover-input" style={{...styles.select, padding:0, border:"none", boxShadow:"none", borderRadius:"16px"}}>
                  <ProvinceSelector
                    provinces={provinces}
                    value={selectedOverviewProvinces}
                    onChange={setSelectedOverviewProvinces}
                  />
                </div>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chỉ số</span>
                <div style={styles.radioGroup}>
                  {[{val:"us_aqi",lab:"AQI"},{val:"pm2_5",lab:"PM2.5"},{val:"pm10",lab:"PM10"}].map(({val,lab}) => (
                    <label key={val} style={styles.radioLabel}>
                      <input type="radio" name="overviewMetric" checked={selectedOverviewMetric===val} onChange={()=>setSelectedOverviewMetric(val)} />
                      {lab}
                    </label>
                  ))}
                </div>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Từ ngày</span>
                <input className="hover-input" type="date" min={MIN_DATE} max={MAX_DATE} value={selectedOverviewStartDate} onChange={e=>setSelectedOverviewStartDate(e.target.value)} style={{...styles.select, minWidth:"180px"}} />
              </div>
              <div style={{...styles.filterBox, justifyContent:"flex-end", paddingBottom:"2px"}}>
                <span style={{...styles.label, opacity:0}}>x</span>
                <span style={{fontWeight:"700", color:theme.textSub, fontSize:"16px", lineHeight:"48px"}}>→</span>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Đến ngày</span>
                <input className="hover-input" type="date" min={MIN_DATE} max={MAX_DATE} value={selectedOverviewEndDate} onChange={e=>setSelectedOverviewEndDate(e.target.value)} style={{...styles.select, minWidth:"180px"}} />
              </div>
            </div>

            {/* POLLUTANT GRID (học từ repo tham khảo: 6 thẻ chất ô nhiễm với icon + giá trị + màu viền) */}
            {data.length > 0 && (() => {
              const latest = data[data.length - 1];
              return (
                <div className="pollutant-grid">
                  {POLLUTANTS.map(({key,label,unit,threshold}) => {
                    const val = overviewStats.average != null && key === (selectedOverviewMetric === 'us_aqi' ? 'pm2_5' : selectedOverviewMetric)
                      ? overviewStats.average
                      : (latest[key] ? parseFloat(latest[key]) : null);
                    const pct = val != null ? (val / threshold) : null;
                    return (
                      <div key={key} className="hover-card" style={{...styles.pollutantCard, borderLeft: `1px solid ${theme.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                          <div>
                            <div style={{fontSize:"12px",fontWeight:"700",color:"#FFFFFF",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
                            <div style={{fontSize:"11px",color:"#FFFFFF",fontWeight:500}}>ngưỡng: {threshold} {unit}</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={styles.pollutantValue}>
                            {val != null ? formatNumber(val, 1) : "--"}
                          </p>
                          <p style={styles.pollutantUnit}>{unit}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className="kpi-responsive">
              {[
                { label:"Chỉ số trung bình",
                  extra: overviewStats.average != null ? getAqiLevel(overviewStats.average) : null,
                  value: overviewStats.average==null ? "--" : `${formatNumber(overviewStats.average, currentOverviewMetricDecimals)} ${currentOverviewMetricLabel!=="AQI"?currentOverviewMetricLabel:""}`.trim() },
                { label:"Mức ô nhiễm cao nhất",
                  extra: overviewStats.max != null ? getAqiLevel(overviewStats.max) : null,
                  value: overviewStats.max==null ? "--" : `${formatNumber(overviewStats.max, currentOverviewMetricDecimals)} ${currentOverviewMetricLabel!=="AQI"?currentOverviewMetricLabel:""}`.trim() },
                { label:"Số trạm báo động",
                  extra: null,
                  value: overviewStats.warningProvinces==null ? "--" : formatNumber(overviewStats.warningProvinces,0) },
                { label:"Vượt chuẩn WHO",
                  extra: null,
                  value: overviewStats.exceedPct==null ? "--" : formatPercent(overviewStats.exceedPct,1) },
              ].map(({label,value,extra}) => (
                <div key={label} className="hover-card" style={styles.kpiCard}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px"}}>
                    <span style={{...styles.label, color: "#FFFFFF"}}>{label}</span>
                    {extra && (
                      <span style={styles.aqiBadge(extra.color)}>&#9679; {extra.label}</span>
                    )}
                  </div>
                  <h3 style={styles.kpiValue}>{value}</h3>
                </div>
              ))}
            </div>

            {/* CHART GRID — asymmetric: map spans 2 rows */}
            <div style={{...styles.chartGrid, gridTemplateColumns:"1.2fr 1fr", gridTemplateRows:"auto auto"}}>
              <div className="hover-card" style={{...styles.chartCard, gridRow:"span 2"}}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle, marginBottom:0}}>Bản đồ AQI theo khu vực</h3>
                  <span style={styles.chartBadge}>Không gian</span>
                </div>
                <BubbleMap 
                  overviewRows={overviewRows}
                  selectedOverviewMetric={selectedOverviewMetric}
                  overviewMetricThreshold={overviewMetricThreshold}
                  currentOverviewMetricLabel={currentOverviewMetricLabel}
                  currentOverviewMetricDecimals={currentOverviewMetricDecimals}
                />
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle, marginBottom:0}}>Tỉ lệ ô nhiễm</h3>
                  <span style={styles.chartBadge}>Donut</span>
                </div>
                <div style={styles.chartPlaceholder}>
                  <p className="placeholder-text">Chưa có dữ liệu</p>
                  <div className="skeleton-line" style={{width:"50%",height:"10px"}} />
                </div>
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle, marginBottom:0}}>Xếp hạng Tỉnh/Thành</h3>
                  <span style={styles.chartBadge}>Thanh ngang</span>
                </div>
                <div style={styles.chartPlaceholder}>
                  <p className="placeholder-text">Chưa có dữ liệu</p>
                  <div className="skeleton-line" style={{width:"55%",height:"10px"}} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "trend" && (
          <>
            <div className="page-header-row">
              <div>
                <h2 style={styles.header}>Phân tích Xu hướng theo Khu vực</h2>
              </div>
            </div>

            <div className="filter-bar-sticky">
              <div style={styles.filterBox}>
                <span style={styles.label}>Tỉnh/thành</span>
                <select className="hover-input" value={selectedTrendProvince} onChange={e=>setSelectedTrendProvince(e.target.value)} style={styles.select}>
                  <option value="">Toàn quốc</option>
                  {provinces.map(p=>(<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chế độ xem</span>
                <div style={styles.radioGroup}>
                  {[{val:"day",lab:"Theo Ngày"},{val:"week",lab:"Theo Tuần"}].map(({val,lab})=>(
                    <label key={val} style={styles.radioLabel}>
                      <input type="radio" name="granularity" checked={selectedTrendGranularity===val} onChange={()=>setSelectedTrendGranularity(val)} />
                      {lab}
                    </label>
                  ))}
                </div>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Chọn ngày</span>
                <input className="hover-input" type="date" min={MIN_DATE} max={MAX_DATE} value={selectedTrendDate} onChange={e=>setSelectedTrendDate(e.target.value)} style={styles.select} />
              </div>
            </div>

            <div className="kpi-responsive">
              {[
                {label:"Trung bình toàn kỳ", value:trendStats.average==null?"--":formatNumber(trendStats.average,0)},
                {label:"Ngày vượt chuẩn", value:trendStats.exceedDays==null?"--":formatNumber(trendStats.exceedDays,0)},
                {label:"Mức biến động", value:trendStats.volatility==null?"--":formatPercent(trendStats.volatility,1)},
                {label:"Cao nhất / Thấp nhất", value:trendStats.max==null?"--":`${formatNumber(trendStats.max,0)} / ${formatNumber(trendStats.min,0)}`},
                {label:"Dự báo đỉnh ô nhiễm", value:trendStats.forecastPeak==null?"--":formatNumber(trendStats.forecastPeak,0)},
                {label:"Tổng giờ rủi ro", value:trendStats.riskHours==null?"--":formatNumber(trendStats.riskHours,0)},
              ].map(({label,value})=>(
                <div key={label} className="hover-card" style={styles.kpiCard}>
                  <div style={{marginBottom:"8px"}}>
                    <span style={{...styles.label, color: "#FFFFFF"}}>{label}</span>
                  </div>
                  <h3 style={styles.kpiValue}>{value}</h3>
                </div>
              ))}
            </div>

            <div style={styles.chartGrid}>
              <div className="hover-card" style={styles.chartCard}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle,marginBottom:0}}>Chuỗi thời gian AQI</h3>
                  <span style={styles.chartBadge}>Line Chart</span>
                </div>
                <TimeSeriesLineChart rows={trendRows} granularity={selectedTrendGranularity} threshold={100} />
              </div>
              <div style={{...styles.chartGrid, gridTemplateColumns:"repeat(3, 1fr)"}}>
                <div className="hover-card" style={styles.chartCard}>
                  <div style={styles.chartTitleRow}>
                    <h3 style={{...styles.chartTitle,marginBottom:0}}>Hộp râu ngoại lai</h3>
                    <span style={styles.chartBadge}>Boxplot</span>
                  </div>
                  <div style={styles.chartPlaceholder}>
                    <p className="placeholder-text">Chưa có dữ liệu</p>
                    <div className="skeleton-line" style={{width:"55%",height:"10px"}}/>
                  </div>
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <div style={styles.chartTitleRow}>
                    <h3 style={{...styles.chartTitle,marginBottom:0}}>Lịch nhiệt</h3>
                    <span style={styles.chartBadge}>Heatmap</span>
                  </div>
                  <CalendarHeatmap data={data} province={selectedTrendProvince} isCompact={true} />
                </div>
                <div className="hover-card" style={styles.chartCard}>
                  <div style={styles.chartTitleRow}>
                    <h3 style={{...styles.chartTitle,marginBottom:0}}>Phân phối Tần suất</h3>
                    <span style={styles.chartBadge}>Histogram</span>
                  </div>
                  <HistogramChart histogramData={histogramData} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "correlation" && (
          <>
            <div className="page-header-row">
              <div>
                <h2 style={styles.header}>Phân tích Tương quan Các Chỉ số</h2>
              </div>
            </div>

            <div className="filter-bar-sticky">
              <div style={styles.filterBox}>
                <span style={styles.label}>Biến Y (mục tiêu)</span>
                <select className="hover-input" value={selectedCorrelationY} onChange={e=>setSelectedCorrelationY(e.target.value)} style={styles.select}>
                  <option value="us_aqi">AQI</option>
                  <option value="pm2_5">PM2.5</option>
                  <option value="pm10">PM10</option>
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Biến X (thành phần)</span>
                <select className="hover-input" value={selectedCorrelationX} onChange={e=>setSelectedCorrelationX(e.target.value)} style={styles.select}>
                  <option value="carbon_monoxide">CO</option>
                  <option value="nitrogen_dioxide">NO2</option>
                  <option value="sulphur_dioxide">SO2</option>
                  <option value="ozone">O3</option>
                  <option value="pm2_5">PM2.5</option>
                  <option value="pm10">PM10</option>
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Tỉnh/thành</span>
                <select className="hover-input" value={selectedCorrelationProvince} onChange={e=>setSelectedCorrelationProvince(e.target.value)} style={styles.select}>
                  <option value="">Toàn quốc</option>
                  {provinces.map(p=>(<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Từ ngày</span>
                <input className="hover-input" type="date" min={MIN_DATE} max={MAX_DATE} value={selectedCorrelationStartDate} onChange={e=>setSelectedCorrelationStartDate(e.target.value)} style={{...styles.select,minWidth:"180px"}} />
              </div>
              <div style={{...styles.filterBox,justifyContent:"flex-end",paddingBottom:"2px"}}>
                <span style={{...styles.label,opacity:0}}>x</span>
                <span style={{fontWeight:"700",color:theme.textSub,fontSize:"16px",lineHeight:"48px"}}>→</span>
              </div>
              <div style={styles.filterBox}>
                <span style={styles.label}>Đến ngày</span>
                <input className="hover-input" type="date" min={MIN_DATE} max={MAX_DATE} value={selectedCorrelationEndDate} onChange={e=>setSelectedCorrelationEndDate(e.target.value)} style={{...styles.select,minWidth:"180px"}} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", marginBottom: "28px" }}>
              {[
                {label:"Hệ số Pearson", value:correlationStats.pearson==null?"--":formatNumber(correlationStats.pearson,3)},
                {label:"Thành phần chủ đạo", value:correlationStats.dominantComponent?? "--"},
                {label:"Tỷ lệ khí thải độc hại", value:correlationStats.hazardRate==null?"--":formatPercent(correlationStats.hazardRate,1)},
              ].map(({label,value})=>(
                <div key={label} className="hover-card" style={{ ...styles.kpiCard, flex: 1, maxWidth: "31%" }}>
                  <div style={{marginBottom:"8px"}}>
                    <span style={{...styles.label, color: "#FFFFFF"}}>{label}</span>
                  </div>
                  <h3 style={styles.kpiValue}>{value}</h3>
                </div>
              ))}
            </div>

            <div style={{...styles.chartGrid, gridTemplateColumns:"1fr 1fr"}}>
              <div className="hover-card" style={styles.chartCard}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle,marginBottom:0}}>Phân tán &amp; Hồi quy</h3>
                  <span style={styles.chartBadge}>Scatter</span>
                </div>
                <div style={{...styles.chartPlaceholder,minHeight:"450px"}}>
                  <p className="placeholder-text">Chưa có dữ liệu</p>
                  <div className="skeleton-line" style={{width:"60%",height:"10px"}}/>
                  <div className="skeleton-line" style={{width:"40%",height:"10px"}}/>
                </div>
              </div>
              <div className="hover-card" style={styles.chartCard}>
                <div style={styles.chartTitleRow}>
                  <h3 style={{...styles.chartTitle,marginBottom:0}}>Biểu đồ Radar</h3>
                  <span style={styles.chartBadge}>Radar</span>
                </div>
                <RadarChart
                  rows={correlationRows}
                  selectedY={selectedCorrelationY}
                  yLabel={CORRELATION_Y_METRICS[selectedCorrelationY]?.label ?? selectedCorrelationY}
                  yThreshold={selectedCorrelationY==="us_aqi"?100:(CORRELATION_X_METRICS[selectedCorrelationY]?.threshold??100)}
                  allXMetrics={CORRELATION_X_METRICS}
                  areaLabel={selectedCorrelationProvince||"Toàn quốc"}
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
