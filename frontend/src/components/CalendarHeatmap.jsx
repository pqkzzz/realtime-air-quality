import React from "react";

/**
 * CalendarHeatmap Component
 * Hiển thị chỉ số AQI trung bình theo lịch 1 tháng (Tháng 4/2026)
 * Phong cách thiết kế: Custom Grid, Responsive, Hover-effects
 */
const CalendarHeatmap = ({ data, province, isCompact = false }) => {
  // 1. Lọc dữ liệu theo tỉnh thành (nếu có chọn)
  const filteredData = province && province !== "Toàn quốc"
    ? data.filter(row => row.province === province)
    : data;

  // 2. Tính trung bình AQI theo ngày
  const dailyMap = {};
  filteredData.forEach(row => {
    const dateKey = row.dateKey;
    if (!dateKey) return;
    
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { sum: 0, count: 0 };
    }
    
    // Đảm bảo row.us_aqi là số
    const aqiVal = typeof row.us_aqi === 'number' ? row.us_aqi : parseFloat(row.us_aqi);
    if (!isNaN(aqiVal)) {
      dailyMap[dateKey].sum += aqiVal;
      dailyMap[dateKey].count += 1;
    }
  });

  const dailyAverages = {};
  Object.keys(dailyMap).forEach(date => {
    if (dailyMap[date].count > 0) {
      dailyAverages[date] = Math.round(dailyMap[date].sum / dailyMap[date].count);
    }
  });

  // Cấu hình cho Tháng 4/2026
  const daysInMonth = 30;
  const startDayOffset = 3; // 1/4/2026 là Thứ Tư (0:CN, 1:T2, 2:T3, 3:T4...)
  const dayNames = isCompact ? ["C", "2", "3", "4", "5", "6", "7"] : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  // Hàm lấy màu sắc theo chuẩn AQI
  const getAqiColor = (aqi) => {
    if (!aqi) return "#F1F5F9"; // Không có dữ liệu
    if (aqi <= 50) return "#10B981";  // Tốt (Xanh lá)
    if (aqi <= 100) return "#F59E0B"; // Trung bình (Vàng)
    if (aqi <= 150) return "#F97316"; // Kém (Cam)
    if (aqi <= 200) return "#EF4444"; // Xấu (Đỏ)
    if (aqi <= 300) return "#8B5CF6"; // Rất xấu (Tím)
    return "#7F1D1D"; // Nguy hại (Nâu đỏ)
  };

  const getTextColor = (aqi) => {
    if (!aqi || aqi <= 100) return "#0F172A";
    return "#FFFFFF";
  };

  return (
    <div style={{
      backgroundColor: isCompact ? "transparent" : "#FFFFFF",
      padding: isCompact ? "0" : "24px",
      borderRadius: isCompact ? "0" : "16px",
      boxShadow: isCompact ? "none" : "0 4px 6px -1px rgba(0,0,0,0.05)",
      border: isCompact ? "none" : "1px solid #E2E8F0",
      width: "100%",
      maxWidth: isCompact ? "100%" : "800px",
      margin: "0 auto",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      {!isCompact && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#1E293B" }}>
            Lịch nhiệt AQI: {province || "Toàn quốc"} (Tháng 04/2026)
          </h3>
          
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {[50, 100, 150, 200, 300, 400].map(val => (
              <div key={val} style={{ 
                width: "12px", 
                height: "12px", 
                borderRadius: "2px", 
                backgroundColor: getAqiColor(val) 
              }} />
            ))}
            <span style={{ fontSize: "11px", color: "#64748B", marginLeft: "4px" }}>Tốt → Nguy hại</span>
          </div>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: isCompact ? "4px" : "10px",
      }}>
        {/* Header các thứ trong tuần */}
        {dayNames.map(day => (
          <div key={day} style={{
            textAlign: "center",
            fontSize: isCompact ? "10px" : "13px",
            fontWeight: "600",
            color: "#64748B",
            paddingBottom: isCompact ? "4px" : "10px",
            textTransform: "uppercase"
          }}>
            {day}
          </div>
        ))}

        {/* Các ô trống trước ngày 1 */}
        {[...Array(startDayOffset)].map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Các ngày trong tháng */}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateStr = `2026-04-${day.toString().padStart(2, "0")}`;
          const aqi = dailyAverages[dateStr];
          const color = getAqiColor(aqi);
          const textColor = getTextColor(aqi);

          return (
            <div
              key={day}
              style={{
                aspectRatio: "1 / 1",
                backgroundColor: color,
                borderRadius: isCompact ? "4px" : "8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                border: aqi ? "none" : "1px dashed #CBD5E1",
              }}
              className="calendar-cell"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.12) translateY(-2px)";
                e.currentTarget.style.zIndex = "10";
                e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.zIndex = "1";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span style={{
                fontSize: isCompact ? "8px" : "11px",
                fontWeight: "600",
                color: textColor,
                opacity: 0.7,
                position: "absolute",
                top: isCompact ? "2px" : "6px",
                left: isCompact ? "3px" : "8px"
              }}>
                {day}
              </span>
              {aqi ? (
                <span style={{
                  fontSize: isCompact ? "12px" : "18px",
                  fontWeight: "800",
                  color: textColor,
                  letterSpacing: "-0.025em"
                }}>
                  {aqi}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      
      {!isCompact && (
        <div style={{ marginTop: "24px", display: "flex", gap: "16px", flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
          {[
            { range: "0-50", label: "Tốt", color: "#10B981" },
            { range: "51-100", label: "Trung bình", color: "#F59E0B" },
            { range: "101-150", label: "Kém", color: "#F97316" },
            { range: "151-200", label: "Xấu", color: "#EF4444" },
            { range: "201-300", label: "Rất xấu", color: "#8B5CF6" },
            { range: "301+", label: "Nguy hại", color: "#7F1D1D" }
          ].map(item => (
            <div key={item.range} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: item.color }}></div>
                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "500" }}>{item.range}: {item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarHeatmap;
