import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAirQualityTimeSeries, useAirQualityGrouped } from "../hooks/useAirQuality";



// Hàm helper để biến đổi dữ liệu từ API thành định dạng cho biểu đồ Line Chart
function buildLineRows(series) {

  const rowMap = new Map();

  series.forEach((station) => {
    station.data.forEach((point) => {
      if (!rowMap.has(point.timestamp)) {
        rowMap.set(point.timestamp, {
          timestamp: point.timestamp,
          timeLabel: new Date(point.timestamp).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
      rowMap.get(point.timestamp)[station.station_id] = point.value;
    });
  });

  return Array.from(rowMap.values()).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

function Home() {
  // Lấy dữ liệu thật từ Backend qua Hooks
  const { 
    data: seriesData, 
    loading: loadingSeries, 
    error: errorSeries 
  } = useAirQualityTimeSeries({ pollutant: 'aqi', range: '24h' });

  const { 
    data: groupsData, 
    loading: loadingGroups, 
    error: errorGroups 
  } = useAirQualityGrouped({ group_by: 'district', pollutant: 'aqi', range: '24h' });

  // Xử lý dữ liệu cho biểu đồ đường (Line Chart)
  const lineRows = buildLineRows(seriesData || []);

  // Nếu đang tải dữ liệu
  if (loadingSeries || loadingGroups) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontSize: "20px" }}>
        Đang tải dữ liệu từ trạm đo...
      </div>
    );
  }

  // Nếu có lỗi
  if (errorSeries || errorGroups) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red" }}>
        Lỗi kết nối: {errorSeries || errorGroups}
      </div>
    );
  }

  return (
    <main style={{ padding: "20px", textAlign: "left" }}>
      <section style={{ marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "30px" }}>Hệ thống Quản lý Chất lượng Không khí</h1>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>Số trạm đang kết nối</p>
          <h3 style={{ margin: "6px 0 0" }}>{seriesData.length}</h3>
        </div>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>Số điểm dữ liệu (24h)</p>
          <h3 style={{ margin: "6px 0 0" }}>{lineRows.length}</h3>
        </div>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>Số khu vực theo dõi</p>
          <h3 style={{ margin: "6px 0 0" }}>{groupsData.length}</h3>
        </div>
      </section>

      <section style={{ display: "grid", gap: "14px" }}>
        <article style={{ border: "1px solid #d8e2e8", borderRadius: "12px", background: "#fff", padding: "14px" }}>
          <header style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>Chỉ số AQI theo thời gian (Line Chart)</h3>
          </header>

          <div style={{ width: "100%", height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineRows} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                {seriesData.map((s, index) => (
                  <Line
                    key={s.station_id}
                    type="monotone"
                    dataKey={s.station_id}
                    name={s.station_name}
                    stroke={index % 2 === 0 ? "#0ea5a5" : "#ef4444"}
                    strokeWidth={2.3}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article style={{ border: "1px solid #d8e2e8", borderRadius: "12px", background: "#fff", padding: "14px" }}>
          <header style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>AQI trung bình theo khu vực (Bar Chart)</h3>
          </header>

          <div style={{ width: "100%", height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupsData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={0} angle={-12} textAnchor="end" height={58} />
                <YAxis />
                <Tooltip formatter={(value) => [value, "AQI avg"]} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                  {groupsData.map((group, index) => (
                    <Cell key={group.id} fill={group.color || (index % 2 === 0 ? "#2563eb" : "#f59e0b")} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  );
}


export default Home;