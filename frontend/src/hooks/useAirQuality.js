import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000'; // Backend URL

/**
 * Custom Hook để lấy dữ liệu chất lượng không khí từ Backend
 * @returns {Object} { data, loading, error }
 */
export function useAirQuality() {
  const [data, setData] = useState([]); // Dữ liệu từ API
  const [loading, setLoading] = useState(true); // Đang tải?
  const [error, setError] = useState(null); // Lỗi gì?

  useEffect(() => {
    // Hàm gọi API
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/example`);
        setData(response.data.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Chỉ chạy 1 lần khi component mount

  return { data, loading, error };
}

/**
 * Custom Hook để thêm dữ liệu chất lượng không khí mới
 * @returns {Function} createData - hàm để tạo dữ liệu mới
 */
export function useCreateAirQuality() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createData = async (newData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/example`, newData);
      setError(null);
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createData, loading, error };
}