import axios from 'axios';

// Địa chỉ của Backend API (Cổng 3000 đã cấu hình trong Backend)
export const API_URL = 'http://localhost:3000/api';

// Tạo một instance axios chung để sử dụng trong toàn bộ project
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Các hàm gọi API cụ thể cho Air Quality
 */

// 1. Lấy dữ liệu mới nhất của tất cả các trạm
export const getLatestAirQuality = () => api.get('/air-quality/latest');

// 2. Lấy danh sách thông tin các trạm đo
export const getStations = () => api.get('/air-quality/stations');

// 3. Lấy dữ liệu lịch sử (theo thời gian)
// params ví dụ: { station_id: 'HCM-001', pollutant: 'aqi', range: '24h' }
export const getTimeSeries = (params) => api.get('/air-quality/timeseries', { params });

// 4. Lấy dữ liệu đã được nhóm (ví dụ: trung bình theo quận/huyện)
// params ví dụ: { group_by: 'district', pollutant: 'aqi' }
export const getGroupedData = (params) => api.get('/air-quality/grouped', { params });

export default api;