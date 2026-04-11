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

const mockSeries = [
  {
    station_id: "HCM-001",
    station_name: "Quan 1 - Ben Nghe",
    pollutant: "aqi",
    data: [
      { timestamp: "2026-04-11T01:00:00.000Z", value: 82 },
      { timestamp: "2026-04-11T04:00:00.000Z", value: 78 },
      { timestamp: "2026-04-11T07:00:00.000Z", value: 95 },
      { timestamp: "2026-04-11T10:00:00.000Z", value: 88 },
      { timestamp: "2026-04-11T13:00:00.000Z", value: 92 },
      { timestamp: "2026-04-11T16:00:00.000Z", value: 101 },
      { timestamp: "2026-04-11T19:00:00.000Z", value: 114 },
      { timestamp: "2026-04-11T22:00:00.000Z", value: 89 },
    ],
  },
  {
    station_id: "HCM-004",
    station_name: "Go Vap - Quang Trung",
    pollutant: "aqi",
    data: [
      { timestamp: "2026-04-11T01:00:00.000Z", value: 104 },
      { timestamp: "2026-04-11T04:00:00.000Z", value: 98 },
      { timestamp: "2026-04-11T07:00:00.000Z", value: 119 },
      { timestamp: "2026-04-11T10:00:00.000Z", value: 112 },
      { timestamp: "2026-04-11T13:00:00.000Z", value: 116 },
      { timestamp: "2026-04-11T16:00:00.000Z", value: 125 },
      { timestamp: "2026-04-11T19:00:00.000Z", value: 138 },
      { timestamp: "2026-04-11T22:00:00.000Z", value: 118 },
    ],
  },
];

const mockGroups = [
  { id: "q1", label: "Quan 1", avg: 92.5, color: "#0ea5a5" },
  { id: "q3", label: "Quan 3", avg: 85.1, color: "#2563eb" },
  { id: "bt", label: "Binh Thanh", avg: 97.3, color: "#f59e0b" },
  { id: "gv", label: "Go Vap", avg: 111.8, color: "#ef4444" },
  { id: "tb", label: "Tan Binh", avg: 89.7, color: "#7c3aed" },
  { id: "q7", label: "Quan 7", avg: 78.4, color: "#16a34a" },
];

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
  const lineRows = buildLineRows(mockSeries);

  return (
    <main style={{ padding: "20px", textAlign: "left" }}>
      <section style={{ marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "30px" }}>Dashboard Setup (Mock Data)</h1>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>So chart setup</p>
          <h3 style={{ margin: "6px 0 0" }}>2</h3>
        </div>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>So diem timeseries</p>
          <h3 style={{ margin: "6px 0 0" }}>{lineRows.length}</h3>
        </div>
        <div style={{ border: "1px solid #d8e2e8", borderRadius: "10px", padding: "12px" }}>
          <p style={{ margin: 0, color: "#64748b" }}>So nhom khu vuc</p>
          <h3 style={{ margin: "6px 0 0" }}>{mockGroups.length}</h3>
        </div>
      </section>

      <section style={{ display: "grid", gap: "14px" }}>
        <article style={{ border: "1px solid #d8e2e8", borderRadius: "12px", background: "#fff", padding: "14px" }}>
          <header style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>Chart 1: AQI theo thoi gian (Line)</h3>
          </header>

          <div style={{ width: "100%", height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineRows} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="HCM-001"
                  name="Quan 1 - Ben Nghe"
                  stroke="#0ea5a5"
                  strokeWidth={2.3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="HCM-004"
                  name="Go Vap - Quang Trung"
                  stroke="#ef4444"
                  strokeWidth={2.3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article style={{ border: "1px solid #d8e2e8", borderRadius: "12px", background: "#fff", padding: "14px" }}>
          <header style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>Chart 2: AQI trung binh theo khu vuc (Bar)</h3>
          </header>

          <div style={{ width: "100%", height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockGroups} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={0} angle={-12} textAnchor="end" height={58} />
                <YAxis />
                <Tooltip formatter={(value) => [value, "AQI avg"]} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                  {mockGroups.map((group) => (
                    <Cell key={group.id} fill={group.color} />
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