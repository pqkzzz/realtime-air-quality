import React from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Hàm định dạng số (copy sang đây để file này chạy độc lập)
function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const BubbleMap = ({
  overviewRows,
  selectedOverviewMetric,
  overviewMetricThreshold,
  currentOverviewMetricLabel,
  currentOverviewMetricDecimals,
}) => {
  return (
    <div
      style={{
        flex: 1,
        minHeight: "450px",
        borderRadius: "16px",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <MapContainer
        center={[16.047079, 108.20623]}
        zoom={5.5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution="&copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {overviewRows.map((row, idx) => {
          const val = row[selectedOverviewMetric];
          if (!Number.isFinite(val)) return null;

          const radius = Math.max(
            6,
            Math.min(25, val / (selectedOverviewMetric === "us_aqi" ? 5 : 2)),
          );
          let color = "#10B981"; // Xanh
          if (val > overviewMetricThreshold * 0.5) color = "#F59E0B"; // Vàng
          if (val > overviewMetricThreshold) color = "#EF4444"; // Đỏ
          if (val > overviewMetricThreshold * 2) color = "#8B5CF6"; // Tím

          return (
            <CircleMarker
              key={idx}
              center={[row.latitude, row.longitude]}
              radius={radius}
              fillColor={color}
              color={color}
              weight={1}
              opacity={0.8}
              fillOpacity={0.6}
            >
              <LeafletTooltip>
                <div style={{ fontFamily: "Inter", fontSize: "13px" }}>
                  <strong>{row.province}</strong>
                  <br />
                  {currentOverviewMetricLabel}:{" "}
                  <span
                    style={{
                      color: color,
                      fontWeight: "bold",
                      fontSize: "15px",
                    }}
                  >
                    {formatNumber(val, currentOverviewMetricDecimals)}
                  </span>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default BubbleMap;
