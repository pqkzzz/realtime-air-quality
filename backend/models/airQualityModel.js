const knex = require("../configs/db");

const TABLE = "air_quality_readings";

/**
 * Chèn một batch readings, bỏ qua nếu đã tồn tại (ON CONFLICT DO NOTHING)
 * @param {Array} readings - mảng object theo schema bảng
 * @returns {number} số dòng được insert thực sự
 */
async function insertReadings(readings) {
  if (!readings.length) return 0;

  const result = await knex(TABLE)
    .insert(readings)
    .onConflict(["station_id", "measured_at"])
    .ignore();

  return result.rowCount ?? result.length ?? 0;
}

/**
 * Lấy reading mới nhất của từng trạm
 */
async function getLatest() {
  return knex(TABLE)
    .select(
      knex.raw(
        "DISTINCT ON (station_id) station_id, station_name, district, lat, lon, " +
          "measured_at, aqi, aqi_category, pm2_5, pm10, no2, so2, co, o3, dust, uv_index",
      ),
    )
    .orderBy("station_id")
    .orderBy("measured_at", "desc");
}

/**
 * Lấy time-series của một hoặc nhiều trạm
 * @param {Object} opts
 * @param {string[]} opts.stationIds
 * @param {Date}     opts.from
 * @param {Date}     opts.to
 * @param {string}   opts.field  - tên cột muốn lấy (mặc định: aqi)
 */
async function getTimeSeries({ stationIds, from, to, field = "aqi" }) {
  const allowedFields = [
    "aqi",
    "pm2_5",
    "pm10",
    "no2",
    "so2",
    "co",
    "o3",
    "dust",
    "uv_index",
  ];
  const col = allowedFields.includes(field) ? field : "aqi";

  return knex(TABLE)
    .select(
      "station_id",
      "station_name",
      "district",
      "measured_at",
      knex.raw(`?? as value`, [col]),
    )
    .whereIn("station_id", stationIds)
    .whereBetween("measured_at", [from, to])
    .whereNotNull(col)
    .orderBy("station_id")
    .orderBy("measured_at", "asc");
}

/**
 * Group by district — trả về avg/min/max của một field trong khoảng thời gian
 */
async function getGroupedByDistrict({ from, to, field = "aqi" }) {
  const allowedFields = ["aqi", "pm2_5", "pm10", "no2", "so2", "co", "o3"];
  const col = allowedFields.includes(field) ? field : "aqi";

  return knex(TABLE)
    .select("district")
    .avg(`${col} as avg`)
    .min(`${col} as min`)
    .max(`${col} as max`)
    .count("* as count")
    .whereBetween("measured_at", [from, to])
    .whereNotNull(col)
    .groupBy("district")
    .orderBy("avg", "desc");
}

/**
 * Group by hour of day
 */
async function getGroupedByHour({ from, to, field = "aqi" }) {
  const allowedFields = ["aqi", "pm2_5", "pm10", "no2", "so2", "co", "o3"];
  const col = allowedFields.includes(field) ? field : "aqi";

  return knex(TABLE)
    .select(
      knex.raw(
        "EXTRACT(HOUR FROM measured_at AT TIME ZONE 'Asia/Ho_Chi_Minh') as hour",
      ),
    )
    .avg(`${col} as avg`)
    .min(`${col} as min`)
    .max(`${col} as max`)
    .count("* as count")
    .whereBetween("measured_at", [from, to])
    .whereNotNull(col)
    .groupBy("hour")
    .orderBy("hour", "asc");
}

/**
 * Xóa dữ liệu cũ hơn N ngày (dọn dẹp định kỳ)
 */
async function deleteOlderThan(days = 90) {
  return knex(TABLE)
    .where(
      "measured_at",
      "<",
      knex.raw(`NOW() - INTERVAL '${parseInt(days)} days'`),
    )
    .delete();
}

module.exports = {
  insertReadings,
  getLatest,
  getTimeSeries,
  getGroupedByDistrict,
  getGroupedByHour,
  deleteOlderThan,
};
