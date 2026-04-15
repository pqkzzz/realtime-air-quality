/**
 * openMeteoService.js
 * Gọi Open Meteo Air Quality API cho các trạm đo tại TP.HCM
 * Docs: https://open-meteo.com/en/docs/air-quality-api
 */

const https = require("https");

// ─────────────────────────────────────────────
// Config trạm đo HCMC — tọa độ thực tế
// ─────────────────────────────────────────────
const STATIONS = [
  {
    id: "HCM-001",
    name: "Quận 1 - Bến Nghé",
    district: "Quận 1",
    lat: 10.7769,
    lon: 106.7009,
  },
  {
    id: "HCM-002",
    name: "Quận 3 - Võ Thị Sáu",
    district: "Quận 3",
    lat: 10.7831,
    lon: 106.6917,
  },
  {
    id: "HCM-003",
    name: "Bình Thạnh - Đinh Bộ Lĩnh",
    district: "Bình Thạnh",
    lat: 10.8142,
    lon: 106.7082,
  },
  {
    id: "HCM-004",
    name: "Gò Vấp - Quang Trung",
    district: "Gò Vấp",
    lat: 10.8385,
    lon: 106.6655,
  },
  {
    id: "HCM-005",
    name: "Tân Bình - Hoàng Văn Thụ",
    district: "Tân Bình",
    lat: 10.8016,
    lon: 106.6524,
  },
  {
    id: "HCM-006",
    name: "Quận 7 - Phú Mỹ Hưng",
    district: "Quận 7",
    lat: 10.7317,
    lon: 106.7214,
  },
];

// Các biến cần lấy từ Open Meteo
const HOURLY_VARS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide", // → lưu vào cột no2
  "sulphur_dioxide", // → lưu vào cột so2
  "carbon_monoxide", // → lưu vào cột co (µg/m³, convert sang mg/m³ khi lưu)
  "ozone", // → lưu vào cột o3
  "dust",
  "uv_index",
  "us_aqi", // AQI chuẩn US EPA, cũng tính PM2.5 AQI
].join(",");

// ─────────────────────────────────────────────
// Bảng phân loại AQI (US EPA)
// ─────────────────────────────────────────────
const AQI_CATEGORIES = [
  { max: 50, label: "Tốt" },
  { max: 100, label: "Trung bình" },
  { max: 150, label: "Kém" },
  { max: 200, label: "Xấu" },
  { max: 300, label: "Rất xấu" },
  { max: 500, label: "Nguy hiểm" },
];

function getAqiCategory(aqi) {
  if (aqi == null) return null;
  for (const c of AQI_CATEGORIES) {
    if (aqi <= c.max) return c.label;
  }
  return "Nguy hiểm";
}

// ─────────────────────────────────────────────
// HTTP helper (dùng built-in https, không cần axios)
// ─────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      family: 4, // ← ép IPv4, bỏ qua IPv6 unreachable
      timeout: 10000, // ← timeout 10s
    };

    https
      .get(url, options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      })
      .on("timeout", function () {
        this.destroy();
        reject(new Error("Request timeout"));
      })
      .on("error", (e) => reject(new Error(`Request error: ${e.message}`)));
  });
}

// ─────────────────────────────────────────────
// Fetch 1 trạm — trả về mảng readings (theo giờ)
// ─────────────────────────────────────────────
async function fetchStation(station) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${station.lat}` +
    `&longitude=${station.lon}` +
    `&hourly=${HOURLY_VARS}` +
    `&timezone=Asia%2FHo_Chi_Minh` +
    `&forecast_days=1`; // chỉ lấy 24h tới để giảm payload

  const data = await httpGet(url);

  if (!data.hourly || !data.hourly.time) {
    throw new Error(`[${station.id}] Response không có trường hourly`);
  }

  const h = data.hourly;
  const readings = [];

  for (let i = 0; i < h.time.length; i++) {
    const co_raw = h.carbon_monoxide?.[i]; // µg/m³ → mg/m³
    readings.push({
      station_id: station.id,
      station_name: station.name,
      district: station.district,
      lat: station.lat,
      lon: station.lon,
      measured_at: new Date(h.time[i]), // ISO string → Date object
      aqi: h.us_aqi?.[i] ?? null,
      aqi_category: getAqiCategory(h.us_aqi?.[i]),
      pm2_5: h.pm2_5?.[i] ?? null,
      pm10: h.pm10?.[i] ?? null,
      no2: h.nitrogen_dioxide?.[i] ?? null,
      so2: h.sulphur_dioxide?.[i] ?? null,
      co: co_raw != null ? parseFloat((co_raw / 1000).toFixed(4)) : null,
      o3: h.ozone?.[i] ?? null,
      dust: h.dust?.[i] ?? null,
      uv_index: h.uv_index?.[i] ?? null,
      source: "open-meteo",
    });
  }

  return readings;
}

// ─────────────────────────────────────────────
// Fetch tất cả trạm — chạy song song, không fail cả batch nếu 1 trạm lỗi
// ─────────────────────────────────────────────
async function fetchAllStations() {
  const results = await Promise.allSettled(STATIONS.map(fetchStation));

  const readings = [];
  const errors = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      readings.push(...r.value);
    } else {
      errors.push({ station: STATIONS[i].id, error: r.reason?.message });
    }
  });

  return { readings, errors };
}

module.exports = { fetchAllStations, STATIONS, getAqiCategory };
