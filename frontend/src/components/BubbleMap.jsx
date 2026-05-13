import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
  useMapEvents,
} from "react-leaflet";

// QUAN TRỌNG: Đảm bảo dòng này luôn ở trên cùng
import "leaflet/dist/leaflet.css";

// ── Bảng màu chuẩn VN_AQI (6 Cấp độ) ──────────────────────────
const AQI_LEVELS = [
  { label: "Tốt", fill: "#34D399", glow: "#059669" }, // Xanh lá
  { label: "Trung bình", fill: "#FCD34D", glow: "#D97706" }, // Vàng
  { label: "Kém", fill: "#FB923C", glow: "#C2410C" }, // Cam
  { label: "Xấu", fill: "#F87171", glow: "#B91C1C" }, // Đỏ
  { label: "Rất xấu", fill: "#C084FC", glow: "#7C3AED" }, // Tím
  { label: "Nguy hại", fill: "#FB7185", glow: "#9F1239" }, // Nâu/Đỏ thẫm
];

// Hàm lấy cấp độ dựa trên tỷ lệ vượt chuẩn
function getLevel(ratio) {
  if (ratio <= 0.5) return 0; // Tốt
  if (ratio <= 1.0) return 1; // Trung bình
  if (ratio <= 1.5) return 2; // Kém
  if (ratio <= 2.0) return 3; // Xấu
  if (ratio <= 3.0) return 4; // Rất xấu
  return 5; // Nguy hại
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const ZoomTracker = ({ onZoomChange }) => {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  useEffect(() => {
    map.invalidateSize();
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
};

// ── Legend (Chú giải) ──
const Legend = () => (
  <div
    style={{
      position: "absolute",
      bottom: 24,
      left: 16,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.9)", // Đổi sang nền trắng kính mờ
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(0,0,0,0.08)", // Viền xám nhạt
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      pointerEvents: "none",
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    }}
  >
    <span
      style={{
        fontSize: 10,
        fontFamily: "'Inter', sans-serif",
        color: "#64748B", // Chữ xám
        textTransform: "uppercase",
        fontWeight: 700,
        marginBottom: 2,
      }}
    >
      Phân cấp không khí
    </span>
    {AQI_LEVELS.map((lvl, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: lvl.fill,
            boxShadow: `0 0 4px ${lvl.glow}88`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "#1E293B", // Chữ tối màu
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
          }}
        >
          {lvl.label}
        </span>
      </div>
    ))}
  </div>
);

const BubbleMap = ({
  overviewRows,
  selectedOverviewMetric,
  overviewMetricThreshold,
  currentOverviewMetricLabel,
  currentOverviewMetricDecimals,
}) => {
  const [currentZoom, setCurrentZoom] = useState(5.5);
  const handleZoomChange = useCallback((z) => setCurrentZoom(z), []);

  const aggregatedData = useMemo(() => {
    const provinceMap = new Map();
    overviewRows.forEach((row) => {
      const val = row[selectedOverviewMetric];
      if (!Number.isFinite(val)) return;
      if (!provinceMap.has(row.province)) {
        provinceMap.set(row.province, { ...row, sum: val, count: 1 });
      } else {
        const curr = provinceMap.get(row.province);
        curr.sum += val;
        curr.count += 1;
      }
    });
    return Array.from(provinceMap.values()).map((item) => ({
      ...item,
      displayVal: item.sum / item.count,
    }));
  }, [overviewRows, selectedOverviewMetric]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: "600px",
        borderRadius: 14,
        overflow: "hidden",
        background: "#F8FAFC", // Nền bao ngoài màu sáng
        border: "1px solid #E2E8F0",
      }}
    >
      <style>{`
        .leaflet-container { background: #F8FAFC !important; height: 100% !important; width: 100% !important; }
        .aqi-tooltip .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .aqi-tooltip .leaflet-tooltip::before { display: none !important; }
      `}</style>

      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[16.047079, 108.20623]}
          zoom={5.5}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <ZoomTracker onZoomChange={handleZoomChange} />

          {/* Đổi TileLayer sang bản sáng (light_all) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/" style="color:#94A3B8">CartoDB</a>'
          />

          {aggregatedData.map((row, idx) => {
            const val = row.displayVal;
            const ratio = val / overviewMetricThreshold;

            const levelIndex = getLevel(ratio);
            const { fill, glow, label } = AQI_LEVELS[levelIndex];

            const base = val / (selectedOverviewMetric === "us_aqi" ? 10 : 4);
            const factor = Math.pow(currentZoom / 5.5, 1.5);
            const radius = Math.max(3, Math.min(25, base * factor));

            return (
              <CircleMarker
                key={idx}
                center={[row.latitude, row.longitude]}
                radius={radius}
                pathOptions={{
                  fillColor: fill,
                  color: glow, // Viền
                  weight: 1.5, // Viền dày hơn xíu để rõ trên nền sáng
                  opacity: 0.9,
                  fillOpacity: 0.75, // Ruột đậm hơn xíu
                }}
                className="aqi-tooltip"
              >
                <LeafletTooltip
                  direction="top"
                  offset={[0, -radius - 4]}
                  opacity={1}
                >
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.95)", // Tooltip nền trắng
                      backdropFilter: "blur(12px)",
                      border: `1px solid ${glow}66`,
                      borderRadius: 12,
                      padding: "12px",
                      minWidth: 140,
                      textAlign: "center",
                      boxShadow: `0 8px 24px rgba(0,0,0,0.12), 0 0 10px ${fill}22`,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748B", // Tên tỉnh màu xám
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: 6,
                      }}
                    >
                      {row.province}
                    </div>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 800,
                        color: glow, // Dùng màu glow cho chữ để sắc nét hơn trên nền trắng
                        lineHeight: 1,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {formatNumber(val, currentOverviewMetricDecimals)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748B",
                        marginTop: 4,
                        fontWeight: 600,
                      }}
                    >
                      {currentOverviewMetricLabel} (TB)
                    </div>

                    <div
                      style={{
                        display: "inline-block",
                        marginTop: 10,
                        background: `${fill}1A`, // Chút nền nhạt
                        border: `1px solid ${fill}44`,
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 10,
                        fontWeight: 800,
                        color: glow, // Chữ đậm màu cấp độ
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
        <Legend />
      </div>
    </div>
  );
};

export default BubbleMap;
