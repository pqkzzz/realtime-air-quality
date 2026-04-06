const db = require('../configs/db');

class ExampleModel {
  static async getAll() {
    // Đây là truy vấn mẫu, bạn cần tạo bảng 'examples' trong Postgres trước khi chạy thực tế
    // Hoặc sửa thành tên bảng bạn muốn: return db('your_table_name').select('*');
    try {
      return await db('examples').select('*');
    } catch (error) {
      // Trả về mảng rỗng nếu bảng chưa tồn tại để tránh crash server khi test mẫu
      if (error.code === '42P01') {
        console.warn('Table "examples" does not exist yet. Please run migrations.');
        return [];
      }
      throw error;
    }
  }

  static async findById(id) {
    return await db('examples').where({ id }).first();
  }

  static async create(data) {
    return await db('examples').insert(data).returning('*');
  }
}

module.exports = ExampleModel;
