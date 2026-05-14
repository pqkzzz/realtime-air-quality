/**
 * backend/scripts/backfill.js
 * Script dùng để lấy dữ liệu lịch sử từ Open-Meteo và đổ vào Database.
 * Chạy lệnh: node scripts/backfill.js
 */

const { STATIONS, fetchStationRange } = require("../services/openMeteoService");
const db = require("../configs/db");

async function runBackfill() {
  // Khoảng thời gian bạn yêu cầu
  const startDate = "2026-04-01";
  const endDate = "2026-05-13";

  console.log(`🚀 Bắt đầu quá trình Backfill dữ liệu từ ${startDate} đến ${endDate}...`);
  console.log(`📊 Tổng cộng có ${STATIONS.length} trạm đo cần xử lý.`);

  let totalInserted = 0;

  for (const station of STATIONS) {
    try {
      console.log(`\n📡 Đang gọi API cho trạm: ${station.name} (${station.id})...`);
      
      // Gọi hàm fetchRange từ service
      const readings = await fetchStationRange(station, startDate, endDate);
      
      if (readings && readings.length > 0) {
        console.log(`📥 Đã tải ${readings.length} bản ghi. Đang lưu vào database...`);
        
        // Thực hiện insert vào bảng air_quality_readings
        // Knex batchInsert không hỗ trợ .onConflict(), nên ta tự chia nhỏ (chunk) và dùng .insert()
        const chunkSize = 500;
        for (let i = 0; i < readings.length; i += chunkSize) {
          const chunk = readings.slice(i, i + chunkSize);
          await db('air_quality_readings')
            .insert(chunk)
            .onConflict(['station_id', 'measured_at'])
            .ignore();
        }

        totalInserted += readings.length;
        console.log(`✅ Hoàn thành trạm ${station.name}.`);
      } else {
        console.log(`⚠️ Không có dữ liệu trả về cho trạm ${station.name}.`);
      }

      // Nghỉ 300ms giữa các trạm để tránh bị Rate Limit từ Open-Meteo
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`❌ Lỗi tại trạm ${station.name}:`, error.message);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏁 HOÀN THÀNH BACKFILL!`);
  console.log(`📦 Tổng số bản ghi đã xử lý: ${totalInserted}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Đóng kết nối DB
  await db.destroy();
  process.exit(0);
}

// Chạy script
runBackfill();
