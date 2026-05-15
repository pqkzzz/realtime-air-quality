const {
  STATIONS,
  POLLUTANTS,
  AQI_CATEGORIES,
  getAqiCategory,
} = require("../configs/mockData");

const {
  getLatest: getLatestFromModel,
  getTimeSeries: getTimeSeriesFromModel,
  getGroupedByDistrict,
  getGroupedByHour,
  getForecasts: getForecastsFromModel,
} = require("../models/airQualityModel");

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

// ─────────────────────────────────────────────
// 0. FULL DATA (FOR LEGACY FRONTEND) – GET /api/air-quality/all
// ─────────────────────────────────────────────
exports.getAllData = async (req, res) => {
  try {
    const knex = require("../configs/db");
    const days = parseInt(req.query.days) || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const fullData = await knex("air_quality_readings")
      .select("*")
      .where("measured_at", ">=", cutoffDate)
      .orderBy("measured_at", "asc");

    const formatted = fullData.map((row) => {
      // Chuyển đổi timestamp sang đối tượng Date
      const d = new Date(row.measured_at);

      // SỬA TẠI ĐÂY: Dùng định dạng của Thụy Điển (sv-SE) để lấy yyyy-mm-dd hh:mm:ss
      // và chỉ định múi giờ là Asia/Ho_Chi_Minh
      const vnTimeStr = d.toLocaleString("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh",
      });

      return {
        province: row.station_name,
        latitude: parseFloat(row.lat),
        longitude: parseFloat(row.lon),
        datetime: vnTimeStr, // Kết quả: "2026-04-01 00:00:00"
        dateKey: vnTimeStr.split(" ")[0], // Kết quả: "2026-04-01"
        pm2_5: row.pm2_5,
        pm10: row.pm10,
        carbon_monoxide: row.co,
        nitrogen_dioxide: row.no2,
        sulphur_dioxide: row.so2,
        ozone: row.o3,
        us_aqi: row.aqi,
        european_aqi: row.european_aqi || row.aqi,
      };
    });

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// 1. TIME-SERIES  –  GET /api/air-quality/timeseries
// ─────────────────────────────────────────────
exports.getTimeSeries = async (req, res) => {
  try {
    const { from, to } = parseTimeRange(req.query);
    const pollutant = req.query.pollutant || "aqi";
    const stationIdsQuery = req.query.station_id
      ? req.query.station_id.split(",").map((s) => s.trim())
      : STATIONS.map((s) => s.id);

    const stations = STATIONS.filter((s) => stationIdsQuery.includes(s.id));
    if (!stations.length) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trạm đo" });
    }

    const dbData = await getTimeSeriesFromModel({
      stationIds: stationIdsQuery,
      from: new Date(from),
      to: new Date(to),
      field: pollutant,
    });

    const seriesMap = {};
    stations.forEach((station) => {
      seriesMap[station.id] = {
        station_id: station.id,
        station_name: station.name,
        district: station.district,
        lat: station.lat,
        lon: station.lon,
        pollutant,
        unit:
          pollutant === "aqi" ? "AQI" : pollutant === "co" ? "mg/m³" : "µg/m³",
        data: [],
      };
    });

    for (const row of dbData) {
      const sMap = seriesMap[row.station_id];
      if (sMap) {
        sMap.data.push({
          timestamp: new Date(row.measured_at).toISOString(),
          value: row.value,
        });
      }
    }

    const series = Object.values(seriesMap);

    return res.json({
      success: true,
      meta: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        pollutant,
        total_points: dbData.length,
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
exports.getGrouped = async (req, res) => {
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

    let groups = [];

    if (groupBy === "district") {
      const dbResult = await getGroupedByDistrict({
        from: new Date(from),
        to: new Date(to),
        field: pollutant,
      });
      groups = dbResult.map((g) => {
        const districtName = g.district;
        const stationsInGroup = STATIONS.filter(
          (s) => s.district === districtName,
        ).map((s) => s.id);
        return {
          id: districtName,
          label: districtName,
          district: districtName,
          pollutant,
          avg: g.avg !== null ? parseFloat(Number(g.avg).toFixed(1)) : null,
          min: g.min !== null ? parseFloat(Number(g.min).toFixed(1)) : null,
          max: g.max !== null ? parseFloat(Number(g.max).toFixed(1)) : null,
          count: parseInt(g.count) || 0,
          stations: stationsInGroup,
        };
      });
    } else if (groupBy === "hour_of_day") {
      const dbResult = await getGroupedByHour({
        from: new Date(from),
        to: new Date(to),
        field: pollutant,
      });
      groups = dbResult
        .map((g) => {
          const h = Number(g.hour);
          const padHour = String(h).padStart(2, "0");
          return {
            id: `${padHour}:00`,
            label: `Giờ ${h}h`,
            pollutant,
            avg: g.avg !== null ? parseFloat(Number(g.avg).toFixed(1)) : null,
            min: g.min !== null ? parseFloat(Number(g.min).toFixed(1)) : null,
            max: g.max !== null ? parseFloat(Number(g.max).toFixed(1)) : null,
            count: parseInt(g.count) || 0,
            hour: h,
            is_peak: (h >= 7 && h <= 9) || (h >= 17 && h <= 19),
          };
        })
        .sort((a, b) => a.hour - b.hour);
    } else {
      // station | aqi_category | pollutant → load real data and group in memory
      let queryField = pollutant;
      if (groupBy === "aqi_category") queryField = "aqi";

      const dbData = await getTimeSeriesFromModel({
        stationIds: STATIONS.map((s) => s.id),
        from: new Date(from),
        to: new Date(to),
        field: queryField,
      });

      if (groupBy === "station") {
        const stationMap = {};
        dbData.forEach((row) => {
          if (!stationMap[row.station_id]) stationMap[row.station_id] = [];
          stationMap[row.station_id].push(row.value);
        });
        groups = STATIONS.map((station) => {
          const values = stationMap[station.id] || [];
          return buildGroup(
            station.id,
            station.name,
            station.district,
            values,
            pollutant,
          );
        });
      } else if (groupBy === "aqi_category") {
        const catMap = {};
        dbData.forEach((row) => {
          if (row.value == null) return;
          const cat = getAqiCategory(Math.round(row.value)).label;
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push(row.value);
        });
        groups = AQI_CATEGORIES.map((c) => {
          const values = catMap[c.label] || [];
          return {
            ...buildGroup(c.label, c.label, null, values, "aqi"),
            color: c.color,
            aqi_range: c.range,
            description: c.description,
            sample_count: values.length,
          };
        }).filter((g) => g.sample_count > 0);
      } else if (groupBy === "pollutant") {
        groups = [];
        for (const p of POLLUTANTS) {
          const tsData = await getTimeSeriesFromModel({
            stationIds: STATIONS.map((s) => s.id),
            from: new Date(from),
            to: new Date(to),
            field: p,
          });
          const values = tsData.map((r) => r.value);
          groups.push({
            ...buildGroup(p, p, null, values, p),
            unit: p === "co" ? "mg/m³" : "µg/m³",
          });
        }
      }
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
exports.getLatest = async (req, res) => {
  try {
    const latestReadings = await getLatestFromModel();

    const stations = latestReadings.map((reading) => {
      const category = getAqiCategory(reading.aqi || 0);
      return {
        station_id: reading.station_id,
        station_name: reading.station_name,
        district: reading.district,
        lat: reading.lat,
        lon: reading.lon,
        timestamp: new Date(reading.measured_at).toISOString(),
        aqi: reading.aqi,
        category: category.label,
        color: category.color,
        description: category.description,
        pollutants: {
          pm2_5: reading.pm2_5,
          pm10: reading.pm10,
          no2: reading.no2,
          so2: reading.so2,
          co: reading.co,
          o3: reading.o3,
          dust: reading.dust,
          uv_index: reading.uv_index,
        },
      };
    });

    const aqiValues = stations.map((s) => s.aqi).filter((a) => a != null);
    const cityAqi = aqiValues.length
      ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
      : null;
    const cityCategory =
      cityAqi != null
        ? getAqiCategory(cityAqi)
        : { label: "Unknown", color: "", description: "" };

    return res.json({
      success: true,
      meta: {
        timestamp: new Date().toISOString(),
        total_stations: stations.length,
      },
      city_summary: {
        aqi: cityAqi,
        category: cityCategory.label,
        color: cityCategory.color,
        description: cityCategory.description,
      },
      stations,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// 4. DAILY FORECAST  –  GET /api/air-quality/forecast
// ─────────────────────────────────────────────
exports.getForecast = async (req, res) => {
  try {
    const stationIdsQuery = req.query.station_id
      ? req.query.station_id.split(",").map((s) => s.trim())
      : STATIONS.map((s) => s.id);

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const forecasts = await getForecastsFromModel({
      stationIds: stationIdsQuery,
      from,
      to,
    });

    // Group by station for better readability
    const result = {};
    STATIONS.filter((s) => stationIdsQuery.includes(s.id)).forEach((s) => {
      result[s.id] = {
        station_id: s.id,
        station_name: s.name,
        district: s.district,
        forecasts: [],
      };
    });

    forecasts.forEach((f) => {
      if (result[f.station_id]) {
        result[f.station_id].forecasts.push({
          date: new Date(f.forecast_date).toISOString().split("T")[0],
          aqi: f.aqi,
          category: f.aqi_category,
          pm2_5: f.pm2_5,
          pm10: f.pm10,
          updated_at: f.fetched_at,
        });
      }
    });

    return res.json({
      success: true,
      meta: {
        total_stations: Object.keys(result).length,
        forecast_days: 7,
      },
      data: Object.values(result),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// 5. STATIONS LIST  –  GET /api/air-quality/stations
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
