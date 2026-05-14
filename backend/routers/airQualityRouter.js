const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/airQualityController");

// BƯỚC 1: IMPORT FILE CRON VÀO ĐÂY
const cronJobs = require("../jobs/airQualityCron");

// Các route cũ của bạn
router.get("/all", ctrl.getAllData);
router.get("/latest", ctrl.getLatest);
router.get("/stations", ctrl.getStations);
router.get("/timeseries", ctrl.getTimeSeries);
router.get("/grouped", ctrl.getGrouped);
router.get("/forecast", ctrl.getForecast);

// BƯỚC 2: THÊM ROUTE POST NÀY VÀO TRƯỚC MODULE.EXPORTS
router.post("/trigger-fetch", async (req, res) => {
  try {
    console.log("🛠️ Nhận yêu cầu chạy fetch thủ công từ Client...");
    await cronJobs.runFetchJob();
    res.json({
      success: true,
      message: "Đã lấy và lưu dữ liệu mới thành công!",
    });
  } catch (error) {
    console.error("Lỗi khi chạy fetch thủ công:", error);
    res
      .status(500)
      .json({ success: false, message: "Có lỗi xảy ra khi lấy dữ liệu." });
  }
});

module.exports = router;
