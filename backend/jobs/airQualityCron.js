/**
 * airQualityCron.js
 * Cron job: fetch data từ Open Meteo và lưu vào PostgreSQL
 * Chạy mỗi 1 giờ — schedule: "0 * * * *"
 *
 * Cài đặt dependency:
 *   npm install node-cron
 */

const cron = require("node-cron");
const {
  fetchAllStations,
  fetchAllDailyForecasts,
} = require("../services/openMeteoService");
const {
  insertReadings,
  upsertForecasts,
  deleteOlderThan,
} = require("../models/airQualityModel");

// ─────────────────────────────────────────────
// Core job logic — tách riêng để có thể gọi thủ công khi test
// ─────────────────────────────────────────────
async function runFetchJob() {
  const startedAt = new Date();
  console.log(`[AQI Cron] ▶ Bắt đầu fetch lúc ${startedAt.toISOString()}`);

  try {
    // 1. Gọi Open Meteo
    const { readings, errors } = await fetchAllStations();

    if (errors.length) {
      errors.forEach((e) =>
        console.warn(
          `[AQI Cron] ⚠ Trạm ${e.station} lỗi: ${
            e.error?.message || JSON.stringify(e.error)
          }`,
        ),
      );
    }

    if (!readings.length) {
      console.warn("[AQI Cron] ⚠ Không có dữ liệu để lưu");
      return;
    }

    // 2. Lọc: Chỉ lấy dữ liệu từ hiện tại trở về trước (Bỏ qua dự báo tương lai)
    // Nhưng vẫn giữ lại toàn bộ quá khứ để tự động vá lỗ hổng dữ liệu
    const now = new Date();
    const toInsert = readings.filter((r) => {
      const t = new Date(r.measured_at);
      return t <= now; // Chỉ lấy những gì đã hoặc đang xảy ra
    });

    console.log(
      `[AQI Cron] 📦 Fetch được ${readings.length} dòng (gồm cả dự báo). Sẽ lưu ${toInsert.length} dòng thực tế vào DB...`,
    );

    // 3. Insert vào DB (ON CONFLICT DO NOTHING)
    const inserted = await insertReadings(toInsert);
    console.log(`[AQI Cron] ✅ Đã insert: ${inserted} dòng mới`);

    // 4. Log tóm tắt AQI theo trạm
    const summary = {};
    toInsert.forEach((r) => {
      if (!summary[r.station_id]) summary[r.station_id] = [];
      if (r.aqi != null) summary[r.station_id].push(r.aqi);
    });
    Object.entries(summary).forEach(([id, vals]) => {
      if (vals.length) {
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        console.log(`[AQI Cron]   ${id}: AQI trung bình = ${avg}`);
      }
    });
  } catch (err) {
    console.error(`[AQI Cron] ✖ Lỗi job:`, err.message);
  } finally {
    const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
    console.log(`[AQI Cron] ⏱ Hoàn thành sau ${elapsed}s`);
  }
}

// ─────────────────────────────────────────────
// Forecast job — fetch 7-day forecast và upsert vào DB
// Chạy lúc 8:00 sáng mỗi ngày
// ─────────────────────────────────────────────
async function runForecastJob() {
  const startedAt = new Date();
  console.log(`[AQI Forecast] ▶ Bắt đầu fetch lúc ${startedAt.toISOString()}`);

  try {
    const { forecasts, errors } = await fetchAllDailyForecasts(7);

    if (errors.length) {
      errors.forEach((e) =>
        console.warn(`[AQI Forecast] ⚠ Trạm ${e.station} lỗi: ${e.error}`),
      );
    }

    if (!forecasts.length) {
      console.warn("[AQI Forecast] ⚠ Không có dữ liệu forecast để lưu");
      return;
    }

    const inserted = await upsertForecasts(forecasts);
    console.log(`[AQI Forecast] ✅ Đã upsert: ${inserted} dòng forecast`);
  } catch (err) {
    console.error(`[AQI Forecast] ✖ Lỗi job:`, err.message);
  } finally {
    const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
    console.log(`[AQI Forecast] ⏱ Hoàn thành sau ${elapsed}s`);
  }
}

// ─────────────────────────────────────────────
// Cleanup job — xóa data cũ hơn 90 ngày, chạy lúc 2:00 sáng mỗi ngày
// ─────────────────────────────────────────────
async function runCleanupJob() {
  try {
    const deleted = await deleteOlderThan(90);
    console.log(`[AQI Cleanup] 🗑 Đã xóa ${deleted} dòng cũ hơn 90 ngày`);
  } catch (err) {
    console.error("[AQI Cleanup] ✖ Lỗi cleanup:", err.message);
  }
}

// ─────────────────────────────────────────────
// Đăng ký cron schedules
// ─────────────────────────────────────────────
function startCronJobs() {
  // 1. Giữ nguyên các lịch trình cũ
  cron.schedule("5 * * * *", runFetchJob, { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("0 2 * * *", runCleanupJob, { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("0 8 * * *", runForecastJob, { timezone: "Asia/Ho_Chi_Minh" });

  console.log("[AQI Cron] ✅ Đã đăng ký lịch trình.");

  // 2. Chạy ngay khi khởi động
  // Chúng ta sẽ chạy runFetchJob() hiện tại để lấy dữ liệu realtime
  runFetchJob();
  runForecastJob();
}

module.exports = { startCronJobs, runFetchJob };
