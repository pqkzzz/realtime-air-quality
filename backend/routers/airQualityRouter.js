const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/airQualityController");

/**
 * Air Quality Routes
 *
 * GET /api/air-quality/latest
 *   → Snapshot mới nhất của tất cả trạm
 *
 * GET /api/air-quality/stations
 *   → Danh sách trạm đo
 *
 * GET /api/air-quality/timeseries
 *   → Dữ liệu theo thời gian
 *   Query: station_id, range|from+to, pollutant
 *
 * GET /api/air-quality/grouped
 *   → Dữ liệu được group
 *   Query: group_by, range|from+to, pollutant
 */

router.get("/latest", ctrl.getLatest);
router.get("/stations", ctrl.getStations);
router.get("/timeseries", ctrl.getTimeSeries);
router.get("/grouped", ctrl.getGrouped);

module.exports = router;
