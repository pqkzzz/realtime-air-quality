const {
  STATIONS,
  POLLUTANTS,
  AQI_CATEGORIES,
  getAqiCategory,
  generateMeasurement,
  randomBetween,
} = require("../configs/mockData");

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function parseTimeRange(query) {
  const now = Date.now();
  const presets = {
    "1h": 1 * 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  if (query.range && presets[query.range]) {
    return { from: now - presets[query.range], to: now };
  }

  const from = query.from
    ? new Date(query.from).getTime()
    : now - presets["24h"];
  const to = query.to ? new Date(query.to).getTime() : now;
  return { from, to };
}

function chooseInterval(fromMs, toMs) {
  const diffH = (toMs - fromMs) / 3600000;
  if (diffH <= 2) return 5 * 60 * 1000; // 5 phút
  if (diffH <= 12) return 30 * 60 * 1000; // 30 phút
  if (diffH <= 48) return 60 * 60 * 1000; // 1 giờ
  if (diffH <= 336) return 6 * 3600 * 1000; // 6 giờ
  return 24 * 3600 * 1000; // 1 ngày
}

// ─────────────────────────────────────────────
// 1. TIME-SERIES  –  GET /api/air-quality/timeseries
// ─────────────────────────────────────────────
// Query params:
//   station_id  – mặc định lấy tất cả
//   range       – 1h | 6h | 12h | 24h | 7d | 30d
//   from / to   – ISO datetime (thay thế range)
//   pollutant   – PM2.5 | PM10 | NO2 | SO2 | CO | O3 | aqi (mặc định: aqi)

exports.getTimeSeries = (req, res) => {
  try {
    const { from, to } = parseTimeRange(req.query);
    const interval = chooseInterval(from, to);
    const pollutant = req.query.pollutant || "aqi";
    const stationIds = req.query.station_id
      ? req.query.station_id.split(",")
      : STATIONS.map((s) => s.id);

    // Chỉ lấy các station hợp lệ
    const stations = STATIONS.filter((s) => stationIds.includes(s.id));
    if (!stations.length) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trạm đo" });
    }

    // Tạo danh sách timestamps
    const timestamps = [];
    for (let t = from; t <= to; t += interval) timestamps.push(t);

    // Mỗi station có base AQI khác nhau để dữ liệu thực tế hơn
    const baseAqiMap = {
      "HCM-001": 95,
      "HCM-002": 88,
      "HCM-003": 75,
      "HCM-004": 110,
      "HCM-005": 82,
      "HCM-006": 65,
    };

    const series = stations.map((station) => {
      const base = baseAqiMap[station.id] || 85;
      const data = timestamps.map((ts) => {
        const m = generateMeasurement(station.id, ts, base);
        return {
          timestamp: new Date(ts).toISOString(),
          value:
            pollutant === "aqi" ? m.aqi : (m.pollutants[pollutant] ?? null),
        };
      });

      return {
        station_id: station.id,
        station_name: station.name,
        district: station.district,
        lat: station.lat,
        lon: station.lon,
        pollutant,
        unit:
          pollutant === "aqi" ? "AQI" : pollutant === "CO" ? "mg/m³" : "µg/m³",
        data,
      };
    });

    return res.json({
      success: true,
      meta: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        interval_ms: interval,
        pollutant,
        total_points: timestamps.length,
      },
      series,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// 2. GROUPED DATA  –  GET /api/air-quality/grouped
// ─────────────────────────────────────────────
// Query params:
//   group_by   – station | district | aqi_category | hour_of_day | pollutant
//   range / from / to  (giống trên)
//   pollutant  – chỉ dùng khi group_by != pollutant (mặc định: aqi)

exports.getGrouped = (req, res) => {
  try {
    const { from, to } = parseTimeRange(req.query);
    const groupBy = req.query.group_by || "district";
    const pollutant = req.query.pollutant || "aqi";

    const validGroups = [
      "station",
      "district",
      "aqi_category",
      "hour_of_day",
      "pollutant",
    ];
    if (!validGroups.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        message: `group_by phải là một trong: ${validGroups.join(", ")}`,
      });
    }

    const baseAqiMap = {
      "HCM-001": 95,
      "HCM-002": 88,
      "HCM-003": 75,
      "HCM-004": 110,
      "HCM-005": 82,
      "HCM-006": 65,
    };

    // Tạo bộ sample measurements (mỗi station x mỗi giờ trong khoảng thời gian)
    const hourMs = 3600 * 1000;
    const samples = [];
    for (let t = from; t <= to; t += hourMs) {
      for (const station of STATIONS) {
        samples.push(
          generateMeasurement(station.id, t, baseAqiMap[station.id] || 85),
        );
      }
    }

    let groups = [];

    // ── Group by STATION ──
    if (groupBy === "station") {
      groups = STATIONS.map((station) => {
        const rows = samples.filter((s) => s.station_id === station.id);
        const values = rows.map((r) =>
          pollutant === "aqi" ? r.aqi : r.pollutants[pollutant],
        );
        return buildGroup(
          station.id,
          station.name,
          station.district,
          values,
          pollutant,
        );
      });
    }

    // ── Group by DISTRICT ──
    else if (groupBy === "district") {
      const districtMap = {};
      for (const station of STATIONS) {
        if (!districtMap[station.district]) districtMap[station.district] = [];
        const rows = samples.filter((s) => s.station_id === station.id);
        districtMap[station.district].push(...rows);
      }
      groups = Object.entries(districtMap).map(([district, rows]) => {
        const values = rows.map((r) =>
          pollutant === "aqi" ? r.aqi : r.pollutants[pollutant],
        );
        const stations_in_group = STATIONS.filter(
          (s) => s.district === district,
        ).map((s) => s.id);
        return {
          ...buildGroup(district, district, null, values, pollutant),
          stations: stations_in_group,
        };
      });
    }

    // ── Group by AQI CATEGORY ──
    else if (groupBy === "aqi_category") {
      const catMap = {};
      for (const row of samples) {
        const cat = row.category;
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(row);
      }
      groups = AQI_CATEGORIES.map((c) => {
        const rows = catMap[c.label] || [];
        const values = rows.map((r) => r.aqi);
        return {
          ...buildGroup(c.label, c.label, null, values, "aqi"),
          color: c.color,
          aqi_range: c.range,
          description: c.description,
          sample_count: rows.length,
        };
      }).filter((g) => g.sample_count > 0);
    }

    // ── Group by HOUR OF DAY ──
    else if (groupBy === "hour_of_day") {
      const hourMap = {};
      for (const row of samples) {
        const h = new Date(row.timestamp).getHours();
        if (!hourMap[h]) hourMap[h] = [];
        hourMap[h].push(row);
      }
      groups = Array.from({ length: 24 }, (_, h) => {
        const rows = hourMap[h] || [];
        const values = rows.map((r) =>
          pollutant === "aqi" ? r.aqi : r.pollutants[pollutant],
        );
        return {
          ...buildGroup(
            `${String(h).padStart(2, "0")}:00`,
            `Giờ ${h}h`,
            null,
            values,
            pollutant,
          ),
          hour: h,
          is_peak: (h >= 7 && h <= 9) || (h >= 17 && h <= 19),
        };
      }).sort((a, b) => a.hour - b.hour);
    }

    // ── Group by POLLUTANT ──
    else if (groupBy === "pollutant") {
      groups = POLLUTANTS.map((p) => {
        const values = samples.map((r) => r.pollutants[p]);
        return {
          ...buildGroup(p, p, null, values, p),
          unit: p === "CO" ? "mg/m³" : "µg/m³",
        };
      });
    }

    return res.json({
      success: true,
      meta: {
        group_by: groupBy,
        pollutant: pollutant === "aqi" ? "aqi" : pollutant,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        total_groups: groups.length,
      },
      groups,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// 3. LATEST SNAPSHOT  –  GET /api/air-quality/latest
// ─────────────────────────────────────────────
exports.getLatest = (req, res) => {
  const now = Date.now();
  const baseAqiMap = {
    "HCM-001": 95,
    "HCM-002": 88,
    "HCM-003": 75,
    "HCM-004": 110,
    "HCM-005": 82,
    "HCM-006": 65,
  };

  const stations = STATIONS.map((station) => {
    const m = generateMeasurement(
      station.id,
      now,
      baseAqiMap[station.id] || 85,
    );
    const category = getAqiCategory(m.aqi);
    return {
      station_id: station.id,
      station_name: station.name,
      district: station.district,
      lat: station.lat,
      lon: station.lon,
      timestamp: new Date(now).toISOString(),
      aqi: m.aqi,
      category: category.label,
      color: category.color,
      description: category.description,
      pollutants: m.pollutants,
      weather: {
        temperature: m.temperature,
        humidity: m.humidity,
        wind_speed: m.wind_speed,
      },
    };
  });

  const aqiValues = stations.map((s) => s.aqi);
  const cityAqi = Math.round(
    aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length,
  );

  return res.json({
    success: true,
    meta: {
      timestamp: new Date(now).toISOString(),
      total_stations: stations.length,
    },
    city_summary: {
      aqi: cityAqi,
      category: getAqiCategory(cityAqi).label,
      color: getAqiCategory(cityAqi).color,
      description: getAqiCategory(cityAqi).description,
    },
    stations,
  });
};

// ─────────────────────────────────────────────
// 4. STATIONS LIST  –  GET /api/air-quality/stations
// ─────────────────────────────────────────────
exports.getStations = (_req, res) => {
  res.json({ success: true, total: STATIONS.length, stations: STATIONS });
};

// ─────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────
function buildGroup(id, label, district, values, pollutant) {
  if (!values.length) {
    return {
      id,
      label,
      district,
      pollutant,
      avg: null,
      min: null,
      max: null,
      count: 0,
    };
  }
  const avg = parseFloat(
    (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
  );
  const min = parseFloat(Math.min(...values).toFixed(1));
  const max = parseFloat(Math.max(...values).toFixed(1));
  const category = pollutant === "aqi" ? getAqiCategory(Math.round(avg)) : null;

  return {
    id,
    label,
    ...(district && { district }),
    pollutant,
    avg,
    min,
    max,
    count: values.length,
    ...(category && { category: category.label, color: category.color }),
  };
}
