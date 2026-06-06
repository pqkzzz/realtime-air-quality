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
  fetchStationRange,
  STATIONS,
} = require("../services/openMeteoService");
const db = require("../configs/db");
const {
  insertReadings,
  upsertForecasts,
  deleteOlderThan,
} = require("../models/airQualityModel");

// ─────────────────────────────────────────────
// Core job logic — tách riêng để có thể gọi thủ công khi test
// ─────────────────────────────────────────────
let socketIo = null; // Biến local để lưu io instance

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

    // 4. Phát tín hiệu Socket.io nếu có dữ liệu mới hoặc thậm chí luôn phát để chắc chắn
    if (socketIo) {
      console.log("[AQI Cron] 📡 Đang phát tín hiệu cập nhật tới Dashboard...");
      socketIo.emit("data-updated", {
        type: "READINGS",
        timestamp: new Date().toISOString(),
      });
    }

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

    if (socketIo) {
      socketIo.emit("data-updated", {
        type: "FORECAST",
        timestamp: new Date().toISOString(),
      });
    }
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
// Tự động vá lỗ hổng dữ liệu (Auto-Backfill) khi khởi động server
// ─────────────────────────────────────────────
async function checkAndBackfillGap() {
  try {
    console.log("[AQI Auto-Backfill] 🔍 Đang kiểm tra khoảng trống dữ liệu trong database...");
    const latestRecord = await db("air_quality_readings")
      .max("measured_at as max_date")
      .first();

    if (!latestRecord || !latestRecord.max_date) {
      console.log("[AQI Auto-Backfill] ℹ️ Cơ sở dữ liệu trống hoặc chưa có dữ liệu quan trắc.");
      return;
    }

    const lastDate = new Date(latestRecord.max_date);
    const now = new Date();
    
    // Tính khoảng cách ngày
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Nếu tắt server hơn 2 ngày (để bù khoảng past_days=2 mặc định)
    if (diffDays >= 2.0) {
      const startDateStr = lastDate.toISOString().split("T")[0];
      const endDateStr = now.toISOString().split("T")[0];

      console.log(`[AQI Auto-Backfill] 🚨 Phát hiện khoảng trống dữ liệu (${diffDays.toFixed(1)} ngày).`);
      console.log(`[AQI Auto-Backfill] ⏳ Tiến hành tự động vá dữ liệu từ ngày ${startDateStr} đến ${endDateStr}...`);

      const CHUNK_SIZE = 3; // Lấy song song theo cụm nhỏ để tránh rate limit
      let gapInserted = 0;
      for (let i = 0; i < STATIONS.length; i += CHUNK_SIZE) {
        const chunk = STATIONS.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(async (station) => {
          try {
            const readings = await fetchStationRange(station, startDateStr, endDateStr);
            if (readings && readings.length > 0) {
              const toInsert = readings.filter(r => new Date(r.measured_at) <= now);
              const count = await db("air_quality_readings")
                .insert(toInsert)
                .onConflict(["station_id", "measured_at"])
                .ignore();
              gapInserted += count.rowCount ?? count.length ?? 0;
            }
          } catch (err) {
            console.error(`[AQI Auto-Backfill] ❌ Lỗi trạm ${station.name}:`, err.message);
          }
        }));
        if (i + CHUNK_SIZE < STATIONS.length) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Nghỉ 1.5s giữa các trạm
        }
      }
      console.log(`[AQI Auto-Backfill] 🎉 Đã tự động vá xong ${gapInserted} bản ghi chất lượng không khí khuyết.`);
      
      if (socketIo) {
        console.log("[AQI Auto-Backfill] 📡 Gửi thông báo cập nhật dữ liệu tới client...");
        socketIo.emit("data-updated", {
          type: "READINGS_BACKFILLED",
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.log(`[AQI Auto-Backfill] ✅ Dữ liệu liên tục (khoảng cách chỉ ${diffDays.toFixed(2)} ngày). Không cần vá.`);
    }
  } catch (err) {
    console.error("[AQI Auto-Backfill] ❌ Lỗi trong quá trình tự động vá:", err.message);
  }
}

// ─────────────────────────────────────────────
// Đăng ký cron schedules
// ─────────────────────────────────────────────
function startCronJobs(io) {
  socketIo = io; // Lưu io vào biến toàn cục của module
  // 1. Giữ nguyên các lịch trình cũ
  cron.schedule("5 * * * *", runFetchJob, { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("0 2 * * *", runCleanupJob, { timezone: "Asia/Ho_Chi_Minh" });
  cron.schedule("0 8 * * *", runForecastJob, { timezone: "Asia/Ho_Chi_Minh" });

  console.log("[AQI Cron] ✅ Đã đăng ký lịch trình.");

  // 2. Chạy ngay sau khi khởi động một chút để không làm chậm server lúc init
  setTimeout(async () => {
    console.log("[AQI Cron] 🚀 Đang chạy fetch ban đầu trong background...");
    await checkAndBackfillGap();
    runFetchJob();
    runForecastJob();
  }, 5000); // Đợi 5 giây sau khi server start mới bắt đầu fetch
}

module.exports = { startCronJobs, runFetchJob };
