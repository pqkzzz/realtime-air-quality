/**
 * airQualityCron.js
 * Cron job: fetch data từ Open Meteo và lưu vào PostgreSQL
 * Chạy mỗi 1 giờ — schedule: "0 * * * *"
 *
 * Cài đặt dependency:
 *   npm install node-cron
 */

const cron = require("node-cron");
const { fetchAllStations } = require("../services/openMeteoService");
const {
  insertReadings,
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

    // 2. Lọc chỉ lấy reading của giờ hiện tại ± 1h để tránh insert quá nhiều
    //    (Open Meteo trả về 24 giờ forecast, mình chỉ cần giờ gần nhất đã xảy ra)
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000); // 1 giờ trước

    const toInsert = readings.filter((r) => {
      const t = new Date(r.measured_at);
      return t <= now && t >= cutoff;
    });

    console.log(
      `[AQI Cron] 📦 Tổng readings fetch được: ${readings.length}, sẽ insert: ${toInsert.length}`,
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
  // Mỗi 1 giờ (vào phút thứ 5 để tránh tranh chấp với các service khác)
  cron.schedule("5 * * * *", runFetchJob, {
    timezone: "Asia/Ho_Chi_Minh",
  });

  // Cleanup: 2:00 AM mỗi ngày
  cron.schedule("0 2 * * *", runCleanupJob, {
    timezone: "Asia/Ho_Chi_Minh",
  });

  console.log("[AQI Cron] ✅ Đã đăng ký cron jobs:");
  console.log("  - Fetch data : mỗi giờ lúc :05 (Asia/Ho_Chi_Minh)");
  console.log("  - Cleanup    : 02:00 AM hàng ngày");

  // Chạy ngay lần đầu khi server khởi động (không cần đợi đến :05)
  console.log("[AQI Cron] 🚀 Chạy fetch lần đầu ngay lúc khởi động...");
  runFetchJob();
}

module.exports = { startCronJobs, runFetchJob };
