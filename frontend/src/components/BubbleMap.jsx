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

// ── Palette AQI ──────────────────────────────────────────────────
const AQI_LEVELS = [
  { label: "Tốt", fill: "#34D399", glow: "#059669" },
  { label: "Trung bình", fill: "#FCD34D", glow: "#D97706" },
  { label: "Kém", fill: "#FB923C", glow: "#C2410C" },
  { label: "Xấu", fill: "#F87171", glow: "#B91C1C" },
  { label: "Rất xấu", fill: "#C084FC", glow: "#7C3AED" },
  { label: "Nguy hiểm", fill: "#FB7185", glow: "#9F1239" },
];

function getLevel(ratio) {
  if (ratio <= 0.5) return 0;
  if (ratio <= 1.0) return 1;
  if (ratio <= 1.5) return 2;
  if (ratio <= 2.0) return 3;
  if (ratio <= 3.0) return 4;
  return 5;
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
    // Ép bản đồ vẽ lại sau khi load để tránh lỗi mất mảnh (tiles)
    map.invalidateSize();
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
};

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
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        marginBottom: 2,
      }}
    >
      Cấp độ ô nhiễm
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
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
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
        .aqi-tooltip .leaflet-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .aqi-tooltip .leaflet-tooltip::before { display: none !important; }
      `}</style>

      <MapContainer
        center={[16.047079, 108.20623]}
        zoom={5.5}
        style={{ height: "680px", width: "100%" }} // Ép cứng chiều cao ở đây
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomTracker onZoomChange={handleZoomChange} />

        {/* Sử dụng link TileLayer ổn định nhất cho Dark Theme */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />

        {aggregatedData.map((row, idx) => {
          const val = row.displayVal;
          const ratio = val / overviewMetricThreshold;
          const level = getLevel(ratio);
          const { fill, glow } = AQI_LEVELS[level];

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
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${glow}88`,
                    borderRadius: 10,
                    padding: "10px",
                    minWidth: 120,
                    textAlign: "center",
                    boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 4,
                    }}
                  >
                    {row.province}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: fill,
                      lineHeight: 1,
                    }}
                  >
                    {formatNumber(val, currentOverviewMetricDecimals)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      marginTop: 4,
                    }}
                  >
                    {currentOverviewMetricLabel} (TB)
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
