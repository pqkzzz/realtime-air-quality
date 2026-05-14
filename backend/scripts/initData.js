const { importHistoricalCsv } = require('../services/csvImportService');
const knex = require('../configs/db');

async function init() {
  try {
    console.log("🛠️ Đang bắt đầu khởi tạo dữ liệu...");
    
    // 1. Chạy Migrations (để đảm bảo bảng đã tồn tại)
    // Lưu ý: knex.migrate.latest() mặc định tìm folder migrations từ knexfile.
    // Vì knexfile của bạn nằm trong configs/, chúng ta cần trỏ đúng.
    console.log("📌 Đang chạy migrations...");
    await knex.migrate.latest();
    
    // 2. Import dữ liệu từ CSV
    console.log("📊 Đang đổ dữ liệu từ CSV vào Database...");
    await importHistoricalCsv();
    
    console.log("✨ Khởi tạo dữ liệu thành công!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo:", err);
    process.exit(1);
  }
}

init();
