const fs = require('fs');
const path = require('path');
const { insertReadings } = require('../models/airQualityModel');

/**
 * Service để đọc file CSV từ frontend và đẩy vào Database
 */
async function importHistoricalCsv() {
  const csvPath = path.join(__dirname, '../../frontend/public/aqi_vietnam_april2026.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error("❌ Không tìm thấy file CSV tại:", csvPath);
    return;
  }

  console.log("📂 Đang đọc file CSV...");
  let content = fs.readFileSync(csvPath, "utf8");

  // Xóa ký tự BOM (nếu có) ở đầu file
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  console.log(`📊 Tìm thấy ${lines.length - 1} dòng dữ liệu.`);

  const headers = lines[0].split(",").map((h) => h.trim());
  const readings = [];
  
  // Bỏ qua header
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => row[h] = values[idx]);

    // Bỏ qua nếu dòng không có thông tin tỉnh thành
    if (!row.province) continue;

    // Ánh xạ dữ liệu CSV vào Schema của Database
    readings.push({
      station_id: row.province.toLowerCase().replace(/\s+/g, "-"),
      station_name: row.province,
      district: row.province, // Tạm thời để district trùng tên tỉnh
      lat: parseFloat(row.latitude),
      lon: parseFloat(row.longitude),
      measured_at: new Date(row.datetime),
      aqi: parseInt(row.us_aqi),
      pm2_5: parseFloat(row.pm2_5),
      pm10: parseFloat(row.pm10),
      co: parseFloat(row.carbon_monoxide),
      no2: parseFloat(row.nitrogen_dioxide),
      so2: parseFloat(row.sulphur_dioxide),
      o3: parseFloat(row.ozone),
      source: 'csv-import'
    });

    // Insert theo từng batch 500 dòng để tránh quá tải
    if (readings.length >= 500) {
      await insertReadings([...readings]);
      readings.length = 0;
      console.log(`✅ Đã chèn ${i}/${lines.length - 1} dòng...`);
    }
  }

  // Chèn nốt phần còn lại
  if (readings.length > 0) {
    await insertReadings(readings);
  }

  console.log("🚀 Hoàn tất import dữ liệu từ CSV!");
}

module.exports = { importHistoricalCsv };
