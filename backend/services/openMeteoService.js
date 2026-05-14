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
    id: "VN-01",
    name: "Tuyên Quang",
    district: "Tuyên Quang",
    lat: 21.8219,
    lon: 105.2155,
  },
  {
    id: "VN-02",
    name: "Cao Bằng",
    district: "Cao Bằng",
    lat: 22.6738,
    lon: 106.257,
  },
  {
    id: "VN-03",
    name: "Lai Châu",
    district: "Lai Châu",
    lat: 22.392,
    lon: 103.4619,
  },
  {
    id: "VN-04",
    name: "Lào Cai",
    district: "Lào Cai",
    lat: 22.4839,
    lon: 103.9749,
  },
  {
    id: "VN-05",
    name: "Thái Nguyên",
    district: "Thái Nguyên",
    lat: 21.5942,
    lon: 105.8482,
  },
  {
    id: "VN-06",
    name: "Điện Biên",
    district: "Điện Biên",
    lat: 21.386,
    lon: 103.018,
  },
  {
    id: "VN-07",
    name: "Lạng Sơn",
    district: "Lạng Sơn",
    lat: 21.8504,
    lon: 106.7588,
  },
  {
    id: "VN-08",
    name: "Sơn La",
    district: "Sơn La",
    lat: 21.3283,
    lon: 103.9048,
  },
  {
    id: "VN-09",
    name: "Phú Thọ",
    district: "Phú Thọ",
    lat: 21.3262,
    lon: 105.2146,
  },
  {
    id: "VN-10",
    name: "Hà Nội",
    district: "Hà Nội",
    lat: 21.0285,
    lon: 105.8542,
  },
  {
    id: "VN-11",
    name: "Hải Phòng",
    district: "Hải Phòng",
    lat: 20.8449,
    lon: 106.6881,
  },
  {
    id: "VN-12",
    name: "Bắc Ninh",
    district: "Bắc Ninh",
    lat: 21.1861,
    lon: 106.0763,
  },
  {
    id: "VN-13",
    name: "Quảng Ninh",
    district: "Quảng Ninh",
    lat: 20.9505,
    lon: 107.0734,
  },
  {
    id: "VN-14",
    name: "Hưng Yên",
    district: "Hưng Yên",
    lat: 20.6464,
    lon: 106.0511,
  },
  {
    id: "VN-15",
    name: "Ninh Bình",
    district: "Ninh Bình",
    lat: 20.2541,
    lon: 105.9783,
  },
  {
    id: "VN-16",
    name: "Thanh Hóa",
    district: "Thanh Hóa",
    lat: 19.8056,
    lon: 105.7766,
  },
  {
    id: "VN-17",
    name: "Nghệ An",
    district: "Nghệ An",
    lat: 18.6733,
    lon: 105.6813,
  },
  {
    id: "VN-18",
    name: "Hà Tĩnh",
    district: "Hà Tĩnh",
    lat: 18.3414,
    lon: 105.9049,
  },
  {
    id: "VN-19",
    name: "Quảng Trị",
    district: "Quảng Trị",
    lat: 16.8118,
    lon: 107.1009,
  },
  { id: "VN-20", name: "Huế", district: "Huế", lat: 16.4637, lon: 107.5909 },
  {
    id: "VN-21",
    name: "Đà Nẵng",
    district: "Đà Nẵng",
    lat: 16.0544,
    lon: 108.2022,
  },
  {
    id: "VN-22",
    name: "Quảng Ngãi",
    district: "Quảng Ngãi",
    lat: 15.1205,
    lon: 108.7923,
  },
  {
    id: "VN-23",
    name: "Gia Lai",
    district: "Gia Lai",
    lat: 13.9808,
    lon: 108.0003,
  },
  {
    id: "VN-24",
    name: "Đắk Lắk",
    district: "Đắk Lắk",
    lat: 12.6667,
    lon: 108.0382,
  },
  {
    id: "VN-25",
    name: "Khánh Hòa",
    district: "Khánh Hòa",
    lat: 12.2451,
    lon: 109.1943,
  },
  {
    id: "VN-26",
    name: "Lâm Đồng",
    district: "Lâm Đồng",
    lat: 11.9404,
    lon: 108.4583,
  },
  {
    id: "VN-27",
    name: "Đồng Nai",
    district: "Đồng Nai",
    lat: 10.9488,
    lon: 106.8202,
  },
  {
    id: "VN-28",
    name: "Tây Ninh",
    district: "Tây Ninh",
    lat: 11.3113,
    lon: 106.0984,
  },
  {
    id: "VN-29",
    name: "Hồ Chí Minh",
    district: "Hồ Chí Minh",
    lat: 10.7626,
    lon: 106.6601,
  },
  {
    id: "VN-30",
    name: "Đồng Tháp",
    district: "Đồng Tháp",
    lat: 10.2898,
    lon: 105.98,
  },
  {
    id: "VN-31",
    name: "An Giang",
    district: "An Giang",
    lat: 10.3759,
    lon: 105.4338,
  },
  {
    id: "VN-32",
    name: "Vĩnh Long",
    district: "Vĩnh Long",
    lat: 10.2548,
    lon: 105.962,
  },
  {
    id: "VN-33",
    name: "Cần Thơ",
    district: "Cần Thơ",
    lat: 10.0452,
    lon: 105.7469,
  },
  { id: "VN-34", name: "Cà Mau", district: "Cà Mau", lat: 9.1769, lon: 105.15 },
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

// ─────────────────────────────────────────────
// Fetch daily forecasts for a station (aggregated from hourly)
// ─────────────────────────────────────────────
async function fetchStationForecast(station, days = 7) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${station.lat}` +
    `&longitude=${station.lon}` +
    `&hourly=us_aqi,pm2_5,pm10` +
    `&timezone=Asia%2FHo_Chi_Minh` +
    `&forecast_days=${days}`;

  const data = await httpGet(url);

  if (!data.hourly || !data.hourly.time) {
    throw new Error(`[${station.id}] Response không có trường hourly`);
  }

  const h = data.hourly;
  const dailyMap = {};

  for (let i = 0; i < h.time.length; i++) {
    const dateStr = h.time[i].split("T")[0]; // YYYY-MM-DD
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        station_id: station.id,
        forecast_date: dateStr,
        aqi: 0,
        pm2_5: 0,
        pm10: 0,
      };
    }

    // Lấy giá trị lớn nhất trong ngày làm đại diện (daily max)
    if (h.us_aqi?.[i] > dailyMap[dateStr].aqi) {
      dailyMap[dateStr].aqi = h.us_aqi[i];
    }
    if (h.pm2_5?.[i] > dailyMap[dateStr].pm2_5) {
      dailyMap[dateStr].pm2_5 = h.pm2_5[i];
    }
    if (h.pm10?.[i] > dailyMap[dateStr].pm10) {
      dailyMap[dateStr].pm10 = h.pm10[i];
    }
  }

  return Object.values(dailyMap).map((d) => ({
    ...d,
    aqi_category: getAqiCategory(d.aqi),
  }));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────
// Fetch tất cả trạm — Chạy tuần tự có delay
// ─────────────────────────────────────────────
async function fetchAllStations() {
  const readings = [];
  const errors = [];

  for (const station of STATIONS) {
    try {
      const data = await fetchStation(station);
      readings.push(...data);
    } catch (err) {
      errors.push({ station: station.id, error: err.message });
    }
    // Nghỉ 200ms giữa mỗi lần gọi API (Chống DDoS / Rate Limit)
    await delay(200);
  }

  return { readings, errors };
}

// ─────────────────────────────────────────────
// Fetch daily forecasts for all stations — Chạy tuần tự
// ─────────────────────────────────────────────
async function fetchAllDailyForecasts(days = 7) {
  const forecasts = [];
  const errors = [];

  for (const station of STATIONS) {
    try {
      const data = await fetchStationForecast(station, days);
      forecasts.push(...data);
    } catch (err) {
      errors.push({ station: station.id, error: err.message });
    }
    // Nghỉ 200ms giữa mỗi lần gọi API
    await delay(200);
  }

  return { forecasts, errors };
}

async function fetchStationRange(station, startDate, endDate) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${station.lat}` +
    `&longitude=${station.lon}` +
    `&hourly=${HOURLY_VARS}` +
    `&timezone=Asia%2FHo_Chi_Minh` +
    `&start_date=${startDate}` + // Định dạng YYYY-MM-DD
    `&end_date=${endDate}`;

  const data = await httpGet(url);

  if (!data.hourly || !data.hourly.time) {
    throw new Error(`[${station.id}] Response không có trường hourly`);
  }

  const h = data.hourly;
  const readings = [];

  for (let i = 0; i < h.time.length; i++) {
    const co_raw = h.carbon_monoxide?.[i];
    readings.push({
      station_id: station.id,
      station_name: station.name,
      district: station.district,
      lat: station.lat,
      lon: station.lon,
      measured_at: new Date(h.time[i]),
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
      source: "open-meteo-historical",
    });
  }

  return readings;
}

/**
 * Lấy dữ liệu trạm trong một khoảng thời gian cụ thể (Dành cho Backfill)
 */
async function fetchStationRange(station, startDate, endDate) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${station.lat}` +
    `&longitude=${station.lon}` +
    `&hourly=${HOURLY_VARS}` + // HOURLY_VARS đã được định nghĩa ở đầu file của bạn
    `&timezone=Asia%2FHo_Chi_Minh` +
    `&start_date=${startDate}` + // Định dạng YYYY-MM-DD
    `&end_date=${endDate}`;

  const data = await httpGet(url);

  if (!data.hourly || !data.hourly.time) {
    throw new Error(`[${station.id}] Response không có trường hourly`);
  }

  const h = data.hourly;
  const readings = [];

  for (let i = 0; i < h.time.length; i++) {
    const co_raw = h.carbon_monoxide?.[i];
    readings.push({
      station_id: station.id,
      station_name: station.name,
      district: station.district,
      lat: station.lat,
      lon: station.lon,
      measured_at: new Date(h.time[i]),
      aqi: h.us_aqi?.[i] ?? null,
      aqi_category: getAqiCategory(h.us_aqi?.[i]), // Hàm getAqiCategory có sẵn trong file của bạn
      pm2_5: h.pm2_5?.[i] ?? null,
      pm10: h.pm10?.[i] ?? null,
      no2: h.nitrogen_dioxide?.[i] ?? null,
      so2: h.sulphur_dioxide?.[i] ?? null,
      co: co_raw != null ? parseFloat((co_raw / 1000).toFixed(4)) : null,
      o3: h.ozone?.[i] ?? null,
      dust: h.dust?.[i] ?? null,
      uv_index: h.uv_index?.[i] ?? null,
      source: "open-meteo-backfill",
    });
  }
  return readings;
}

module.exports = {
  fetchAllStations,
  fetchAllDailyForecasts,
  fetchStationRange,
  STATIONS,
  getAqiCategory,
};
