import React, { useMemo } from "react";
import Chart from "react-apexcharts";

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "--";
  const parts = String(value).split("-");
  if (parts.length !== 3) return "--";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const position = (sortedValues.length - 1) * q;
  const baseIndex = Math.floor(position);
  const rest = position - baseIndex;
  const next = sortedValues[baseIndex + 1];

  if (next === undefined) return sortedValues[baseIndex];
  return sortedValues[baseIndex] + rest * (next - sortedValues[baseIndex]);
}

function getMetricValue(row, metricKey) {
  const raw = row?.[metricKey] ?? row?.us_aqi ?? row?.AQI;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function BoxPlotAnomalies({
  rows = [],
  metricKey = "us_aqi",
  provinceLabel = "Toàn quốc",
  dateRangeLabel = "",
}) {
  const chartBundle = useMemo(() => {
    const byDay = new Map();

    rows.forEach((row) => {
      const dateKey = row?.dateKey ?? String(row?.datetime ?? "").split(" ")[0];
      const value = getMetricValue(row, metricKey);
      if (!dateKey || !Number.isFinite(value)) return;

      if (!byDay.has(dateKey)) byDay.set(dateKey, []);
      byDay.get(dateKey).push(value);
    });

    const daily = Array.from(byDay.entries())
      .map(([dateKey, values]) => ({
        dateKey,
        values: values.slice().sort((a, b) => a - b),
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const boxData = [];
    const scatterData = [];
    let totalOutliers = 0;
    let medianSum = 0;

    daily.forEach(({ dateKey, values }) => {
      if (values.length < 2) return;

      const q1 = quantile(values, 0.25);
      const median = quantile(values, 0.5);
      const q3 = quantile(values, 0.75);
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;

      const inside = values.filter((v) => v >= lower && v <= upper);
      const outliers = values.filter((v) => v < lower || v > upper);

      const min = inside.length ? Math.min(...inside) : q1;
      const max = inside.length ? Math.max(...inside) : q3;

      boxData.push({
        x: formatDate(dateKey),
        y: [min, q1, median, q3, max].map((v) => Number(v.toFixed(1))),
      });

      outliers.forEach((outlier) => {
        scatterData.push({
          x: formatDate(dateKey),
          y: Number(outlier.toFixed(1)),
        });
      });

      totalOutliers += outliers.length;
      medianSum += median;
    });

    return {
      series: [
        {
          name: "Hộp phân vị",
          type: "boxPlot",
          data: boxData,
        },
        {
          name: "Dị thường",
          type: "scatter",
          data: scatterData,
        },
      ],
      days: daily.length,
      outliers: totalOutliers,
      median:
        boxData.length > 0 ? medianSum / boxData.length : null,
      startDate: daily[0]?.dateKey ?? null,
      endDate: daily[daily.length - 1]?.dateKey ?? null,
    };
  }, [rows, metricKey]);

  const options = useMemo(
    () => ({
      chart: {
        type: "boxPlot",
        toolbar: { show: false },
        background: "transparent",
        fontFamily: "Inter, sans-serif",
        animations: { enabled: true },
      },
      colors: ["#64748B", "#EF4444"],
      plotOptions: {
        boxPlot: {
          colors: {
            upper: "#94A3B8",
            lower: "#CBD5E1",
          },
        },
      },
      stroke: {
        width: [2, 0],
        colors: ["#475569", "#EF4444"],
      },
      markers: {
        size: [0, 5],
        strokeWidth: 2,
        hover: {
          size: 6,
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: "#E2E8F0",
        strokeDashArray: 4,
      },
      xaxis: {
        type: "category",
        labels: {
          style: {
            colors: "#64748B",
            fontWeight: 600,
            fontSize: "11px",
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: {
          text: "AQI",
          style: {
            color: "#64748B",
            fontWeight: 700,
          },
        },
        labels: {
          style: {
            colors: "#64748B",
          },
          formatter: (value) => formatNumber(value, 0),
        },
      },
      legend: {
        position: "top",
        horizontalAlign: "left",
        markers: { radius: 12 },
        fontSize: "12px",
        fontWeight: 700,
        itemMargin: {
          horizontal: 12,
          vertical: 4,
        },
      },
      tooltip: {
        shared: false,
        intersect: true,
        theme: "light",
        y: {
          formatter: (value) => formatNumber(value, 1),
        },
      },
    }),
    []
  );

  if (!rows.length || chartBundle.days === 0) {
    return (
      <div
        style={{
          height: "320px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748B",
          background: "#F8FAFC",
          borderRadius: "12px",
          border: "1px dashed #E2E8F0",
          fontWeight: 600,
        }}
      >
        Không có dữ liệu cho khoảng thời gian này
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
            Nhận diện ngoại lai theo IQR
          </div>
          <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", lineHeight: 1.5 }}>
            Khu vực: {provinceLabel} · Thời gian: {dateRangeLabel || `${formatDate(chartBundle.startDate)} - ${formatDate(chartBundle.endDate)}`}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 12px", minWidth: "100px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Số ngày</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
              {formatNumber(chartBundle.days, 0)}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 12px", minWidth: "110px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Ngoại lai</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
              {formatNumber(chartBundle.outliers, 0)}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 12px", minWidth: "110px" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Trung vị TB</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
              {chartBundle.median == null ? "--" : formatNumber(chartBundle.median, 1)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: "260px" }}>
        <Chart options={options} series={chartBundle.series} type="boxPlot" height={260} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "999px", padding: "7px 10px", fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#EF4444" }} />
          Điểm đỏ
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "999px", padding: "7px 10px", fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "4px", background: "#94A3B8" }} />
          Hộp tứ phân vị
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "999px", padding: "7px 10px", fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#111827" }} />
          Trung vị
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "999px", padding: "7px 10px", fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#64748B" }} />
          Râu
        </div>
      </div>
    </div>
  );
}

export default BoxPlotAnomalies;