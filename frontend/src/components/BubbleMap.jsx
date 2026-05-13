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
// Mỗi cấp có fill (ruột sáng hơn), glow (viền và bóng mờ đậm hơn)
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
      background: "rgba(10, 14, 26, 0.85)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      pointerEvents: "none",
    }}
  >
    <span
      style={{
        fontSize: 10,
        fontFamily: "'Inter', sans-serif",
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        fontWeight: 600,
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
            boxShadow: `0 0 6px ${lvl.fill}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
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
        flex: 1,
        minHeight: 680,
        height: "100%",
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        background: "#0a0e1a",
      }}
    >
      <style>{`
        .leaflet-container { background: #0a0e1a !important; }
        .aqi-tooltip .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .aqi-tooltip .leaflet-tooltip::before { display: none !important; }
      `}</style>

      <MapContainer
        center={[16.047079, 108.20623]}
        zoom={5.5}
        style={{ height: "680px", width: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomTracker onZoomChange={handleZoomChange} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://carto.com/" style="color:rgba(255,255,255,0.3)">CartoDB</a>'
        />

        {aggregatedData.map((row, idx) => {
          const val = row.displayVal;
          const ratio = val / overviewMetricThreshold;

          // --- SỬ DỤNG MÀU CHUẨN TỪ AQI_LEVELS ---
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
                color: glow,
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.7,
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
                    background: "rgba(8, 11, 22, 0.95)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${glow}BB`, // Viền tooltip nổi bật theo màu cấp độ
                    borderRadius: 12,
                    padding: "12px",
                    minWidth: 140,
                    textAlign: "center",
                    boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 15px ${fill}33`,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
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
                      color: fill, // Con số lớn nổi bật
                      lineHeight: 1,
                      fontFamily: "'Inter', sans-serif",
                      textShadow: `0 0 10px ${fill}66`,
                    }}
                  >
                    {formatNumber(val, currentOverviewMetricDecimals)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                      fontWeight: 500,
                    }}
                  >
                    {currentOverviewMetricLabel} (TB)
                  </div>

                  {/* Badge thể hiện Cấp độ ô nhiễm */}
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      background: `${fill}22`,
                      border: `1px solid ${fill}66`,
                      borderRadius: 20,
                      padding: "3px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: fill,
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
  );
};

export default BubbleMap;
