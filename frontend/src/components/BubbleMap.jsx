import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useGemini } from "../hooks/useGemini";
import { apiUrl } from "../config/api";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
  useMapEvents,
} from "react-leaflet";

// QUAN TRỌNG: Đảm bảo dòng này luôn ở trên cùng
import "leaflet/dist/leaflet.css";

// ── Bảng màu chuẩn VN_AQI & CÂU NHẮC NHỞ TƯƠNG ỨNG ──────────────────────────
const AQI_LEVELS = [
  {
    label: "Tốt",
    fill: "#34D399",
    glow: "#059669",
    message: "Trời trong lành, tận hưởng hoạt động ngoài trời thôi!",
  },
  {
    label: "Trung bình",
    fill: "#FCD34D",
    glow: "#D97706",
    message: "Chất lượng không khí chấp nhận được.",
  },
  {
    label: "Kém",
    fill: "#FB923C",
    glow: "#C2410C",
    message: "Nhóm nhạy cảm (trẻ em, người già) nên hạn chế ra ngoài.",
  },
  {
    label: "Xấu",
    fill: "#F87171",
    glow: "#B91C1C",
    message: "Bắt đầu ô nhiễm. Nhớ mang khẩu trang khi ra đường nhé!",
  },
  {
    label: "Rất xấu",
    fill: "#C084FC",
    glow: "#7C3AED",
    message: "Ô nhiễm nặng! Hạn chế tối đa việc mở cửa sổ và ra ngoài.",
  },
  {
    label: "Nguy hại",
    fill: "#FB7185",
    glow: "#9F1239",
    message: "🚨 Cảnh báo khẩn cấp: Mọi người nên ở yên trong nhà!",
  },
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
    map.invalidateSize();
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
};

// ── Legend (Chú giải) góc TRÊN PHẢI ──
const Legend = () => (
  <div
    style={{
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.92)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      pointerEvents: "none",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}
  >
    <span
      style={{
        fontSize: 10,
        fontFamily: "'Inter', sans-serif",
        color: "#64748B",
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
            color: "#1E293B",
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
  // === DÁN NGUYÊN CỤC NÀY VÀO ĐÂY NHÉ KHOA ===
  const { generateInsight, loadingAI } = useGemini();
  const [localInsight, setLocalInsight] = useState("");
  const [selectedProv, setSelectedProv] = useState(null);
  const [forecastData, setForecastData] = useState([]);

  useEffect(() => {
    fetch(apiUrl("/air-quality/forecast"))
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForecastData(data.data);
        }
      })
      .catch((err) => console.error("Lỗi fetch forecast:", err));
  }, []);

  const handleAnalyzeProvince = async (row, val) => {
    const provForecast = forecastData.find((f) => f.station_name === row.province);
    
    // Lọc lấy 3 ngày dự báo tiếp theo (tính từ ngày mai, KHÔNG lấy ngày hiện tại)
    const todayStr = new Date().toISOString().split("T")[0];
    const next3Days = (provForecast?.forecasts || [])
      .filter(f => f.date > todayStr)
      .slice(0, 3);

    setSelectedProv({ name: row.province, aqi: val, forecast: next3Days });
    setLocalInsight("");

    const customPrompt = `Bạn là chuyên gia môi trường bản địa. Hãy phân tích số liệu AQI là ${val.toFixed(1)} tại tỉnh ${row.province}. 
    Yêu cầu: KHÔNG nhận xét máy móc theo khoảng số. HÃY dùng tri thức địa lý, đặc thù công nghiệp/giao thông/khí hậu của ${row.province} để giải thích. 
    Trả về cấu trúc 4 dòng:
    - Nhận xét chính: [Đánh giá ô nhiễm]
    - Lý do chuyên sâu: [Đặc thù địa phương]
    - Góc nhìn quản lý: [Kiểm tra nguồn phát thải nào]
    - Lời khuyên người dân: [Hành động bảo vệ sức khỏe]
    Tối đa 5 câu ngắn gọn.`;

    const result = await generateInsight(customPrompt);
    setLocalInsight(result);
  };
  // === KẾT THÚC CỤC CẦN DÁN ===
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
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
      }}
    >
      <style>{`
        /* Thêm z-index: 1 vào leaflet-container để giới hạn không cho nó tràn lên đè Header */
        .leaflet-container { background: #F8FAFC !important; height: 100% !important; width: 100% !important; z-index: 1 !important; }
        .aqi-tooltip .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .aqi-tooltip .leaflet-tooltip::before { display: none !important; }
      `}</style>

      {/* Đã thêm zIndex: 0 vào div này để chặn triệt để lỗi đè Layout */}
      <div style={{ flex: 1, position: "relative", zIndex: 0 }}>
        <MapContainer
          center={[16.047079, 108.20623]}
          zoom={5.5}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <ZoomTracker onZoomChange={handleZoomChange} />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/" style="color:#94A3B8">CartoDB</a>'
          />

          {aggregatedData.map((row, idx) => {
            const val = row.displayVal;
            const ratio = val / overviewMetricThreshold;

            const levelIndex = getLevel(ratio);
            const { fill, glow, label, message } = AQI_LEVELS[levelIndex];

            const base = val / (selectedOverviewMetric === "us_aqi" ? 10 : 4);
            const factor = Math.pow(currentZoom / 5.5, 1.5);
            const radius = Math.max(3, Math.min(25, base * factor));

            return (
              <CircleMarker
                key={idx}
                center={[row.latitude, row.longitude]}
                radius={radius}
                eventHandlers={{ click: () => handleAnalyzeProvince(row, val) }}
                pathOptions={{
                  fillColor: fill,
                  color: glow,
                  weight: 1.5,
                  opacity: 0.9,
                  fillOpacity: 0.75,
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
                      background: "rgba(255, 255, 255, 0.95)",
                      // backdropFilter: "blur(12px)", // <-- Đã bỏ blur đi cho đỡ lag (nếu có yêu cầu)
                      border: `1px solid ${glow}66`,
                      borderRadius: 12,
                      padding: "12px",
                      minWidth: 160,
                      maxWidth: 200,
                      textAlign: "center",
                      boxShadow: `0 8px 24px rgba(0,0,0,0.12), 0 0 10px ${fill}22`,
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: "normal",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748B",
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
                        color: glow,
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
                        background: `${fill}1A`,
                        border: `1px solid ${fill}44`,
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 10,
                        fontWeight: 800,
                        color: glow,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {label}
                    </div>

                    {/* KHU VỰC CHÈN LỜI NHẮC NHỞ */}
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "#475569",
                        fontWeight: 500,
                        lineHeight: 1.4,
                        borderTop: `1px dashed #E2E8F0`,
                        paddingTop: 8,
                      }}
                    >
                      {message}
                    </div>
                  </div>
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        <Legend />
        {/* === BẢNG AI INSIGHT CỦA KHOA === */}
        {selectedProv && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16, 
              zIndex: 1000,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 16,
              padding: "16px 20px",
              width: 340,
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1E3A8A", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "16px" }}>✨</span>
                AI Insight: {selectedProv.name}
              </h4>
              <button
                onClick={() => setSelectedProv(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: "16px", color: "#64748B" }}
              >
                ✖
              </button>
            </div>

            {loadingAI ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "24px", display: "inline-block", marginBottom: 8 }}>⏳</span>
                <span style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>AI đang phân tích...</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {localInsight}
                </div>
                {selectedProv.forecast && selectedProv.forecast.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px dashed #CBD5E1" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 8 }}>
                      📅 Dự báo 3 ngày tới:
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                      {selectedProv.forecast.map((f, i) => {
                        // Tính toán màu tương ứng với AQI
                        let color = "#34D399";
                        if (f.aqi > 50) color = "#FCD34D";
                        if (f.aqi > 100) color = "#FB923C";
                        if (f.aqi > 150) color = "#F87171";
                        if (f.aqi > 200) color = "#C084FC";
                        if (f.aqi > 300) color = "#FB7185";
                        
                        const dateObj = new Date(f.date);
                        const dayStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

                        return (
                          <div key={i} style={{ flex: 1, background: "rgba(0,0,0,0.02)", borderRadius: 8, padding: "8px 4px", textAlign: "center", border: "1px solid #E2E8F0" }}>
                            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{dayStr}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: color, margin: "4px 0" }}>{f.aqi}</div>
                            <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>{f.category}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* === KẾT THÚC BẢNG AI === */}
      </div>
    </div>
  );
};

export default React.memo(BubbleMap);
