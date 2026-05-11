import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const TimeSeriesLineChart = ({ rows = [], granularity = "day", threshold = 100 }) => {
  const chartData = useMemo(() => {
    if (!rows.length) return [];

    const sorted = [...rows].sort((a, b) => a.datetime.localeCompare(b.datetime));

    if (granularity === "day") {
      // Group by hour
      const hourly = {};
      sorted.forEach((row) => {
        const hour = row.hour;
        if (!hourly[hour]) {
          hourly[hour] = { hour: `${String(hour).padStart(2, "0")}:00`, us_aqi: [], pm2_5: [], pm10: [] };
        }
        if (Number.isFinite(row.us_aqi)) hourly[hour].us_aqi.push(row.us_aqi);
        if (Number.isFinite(row.pm2_5)) hourly[hour].pm2_5.push(row.pm2_5);
        if (Number.isFinite(row.pm10)) hourly[hour].pm10.push(row.pm10);
      });

      return Object.keys(hourly)
        .sort((a, b) => Number(a) - Number(b))
        .map((h) => ({
          name: hourly[h].hour,
          us_aqi: hourly[h].us_aqi.length ? hourly[h].us_aqi.reduce((a, b) => a + b, 0) / hourly[h].us_aqi.length : null,
          pm2_5: hourly[h].pm2_5.length ? hourly[h].pm2_5.reduce((a, b) => a + b, 0) / hourly[h].pm2_5.length : null,
          pm10: hourly[h].pm10.length ? hourly[h].pm10.reduce((a, b) => a + b, 0) / hourly[h].pm10.length : null,
        }));
    } else {
      // Group by dateKey
      const daily = {};
      sorted.forEach((row) => {
        const date = row.dateKey;
        if (!daily[date]) {
          daily[date] = { date, us_aqi: [], pm2_5: [], pm10: [] };
        }
        if (Number.isFinite(row.us_aqi)) daily[date].us_aqi.push(row.us_aqi);
        if (Number.isFinite(row.pm2_5)) daily[date].pm2_5.push(row.pm2_5);
        if (Number.isFinite(row.pm10)) daily[date].pm10.push(row.pm10);
      });

      return Object.keys(daily)
        .sort()
        .map((d) => {
          const [, m, day] = d.split("-");
          return {
            name: `${day}/${m}`,
            us_aqi: daily[d].us_aqi.length ? daily[d].us_aqi.reduce((a, b) => a + b, 0) / daily[d].us_aqi.length : null,
            pm2_5: daily[d].pm2_5.length ? daily[d].pm2_5.reduce((a, b) => a + b, 0) / daily[d].pm2_5.length : null,
            pm10: daily[d].pm10.length ? daily[d].pm10.reduce((a, b) => a + b, 0) / daily[d].pm10.length : null,
          };
        });
    }
  }, [rows, granularity]);

  if (!rows.length) {
    return (
      <div style={{ height: "350px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", background: "#F8FAFC", borderRadius: "12px", border: "2px dashed #E2E8F0" }}>
        Không có dữ liệu cho khoảng thời gian này
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1E293B", border: "none", borderRadius: "8px", color: "#F8FAFC" }}
            itemStyle={{ fontSize: "12px" }}
            formatter={(value) => (value ? value.toFixed(1) : "--")}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", fontWeight: 600, paddingBottom: "10px" }}
          />
          <ReferenceLine y={threshold} label={{ value: "Ngưỡng", position: "top", fill: "#EF4444", fontSize: 10 }} stroke="#EF4444" strokeDasharray="3 3" />
          <Line
            name="AQI"
            type="monotone"
            dataKey="us_aqi"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6 }}
          />
          <Line
            name="PM2.5"
            type="monotone"
            dataKey="pm2_5"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 3 }}
            hide={false}
          />
          <Line
            name="PM10"
            type="monotone"
            dataKey="pm10"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3 }}
            hide={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimeSeriesLineChart;
