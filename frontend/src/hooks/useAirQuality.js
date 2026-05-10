import { useState, useEffect } from 'react';
import { 
  getLatestAirQuality, 
  getTimeSeries, 
  getGroupedData 
} from '../services/api';

/**
 * Hook để lấy dữ liệu chất lượng không khí mới nhất của toàn thành phố
 */
export function useLatestAirQuality() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getLatestAirQuality();
        setData(response.data); // Chứa { city_summary, stations, meta }
        setError(null);
      } catch (err) {
        setError(err.message || 'Không thể lấy dữ liệu mới nhất');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook để lấy dữ liệu biểu đồ đường (Time-series)
 * @param {Object} params - { station_id, pollutant, range }
 */
export function useAirQualityTimeSeries(params = { pollutant: 'aqi', range: '24h' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getTimeSeries(params);
        setData(response.data.series || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Không thể lấy dữ liệu lịch sử');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.station_id, params.pollutant, params.range]);

  return { data, loading, error };
}

/**
 * Hook để lấy dữ liệu biểu đồ cột (Grouped)
 * @param {Object} params - { group_by, pollutant, range }
 */
export function useAirQualityGrouped(params = { group_by: 'district', pollutant: 'aqi', range: '24h' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getGroupedData(params);
        setData(response.data.groups || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Không thể lấy dữ liệu phân nhóm');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.group_by, params.pollutant, params.range]);

  return { data, loading, error };
}