import React, { useState, useEffect } from "react";

/**
 * CalendarHeatmap Component - Bản nâng cấp Dynamic
 * - Tự động tính toán lịch theo Tháng/Năm
 * - Có nút điều chuyển tháng
 * - Click vào ngày để chọn mốc thời gian cho Dashboard
 */
const CalendarHeatmap = ({ data, province, selectedDate, onDateSelect, isCompact = false }) => {
  // 1. Khởi tạo trạng thái tháng đang xem (mặc định lấy theo ngày đang chọn)
  const [viewDate, setViewDate] = useState(new Date(selectedDate || "2026-04-15"));

  // Cập nhật viewDate khi selectedDate từ bên ngoài thay đổi (ví dụ đổi từ filter chính)
  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // 2. Lọc dữ liệu theo tỉnh thành (Lấy toàn bộ dữ liệu của tỉnh để hiện màu cả tháng)
  const filteredData = province && province !== "Toàn quốc"
    ? data.filter(row => row.province === province)
    : data;

  // 3. Tính trung bình AQI theo ngày
  const dailyMap = {};
  filteredData.forEach(row => {
    const dateKey = row.dateKey;
    if (!dateKey) return;
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { sum: 0, count: 0 };
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

  // 4. Logic tính toán lịch động
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOffset = firstDayOfMonth.getDay(); // 0: CN, 1: T2...
  
  const monthName = `Tháng ${month + 1}`;
  const dayNames = isCompact ? ["C", "2", "3", "4", "5", "6", "7"] : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  // 5. Điều hướng tháng
  const changeMonth = (offset) => {
    const newDate = new Date(year, month + offset, 1);
    setViewDate(newDate);
  };

  // 6. Màu sắc & Style
  const getAqiColor = (aqi) => {
    if (!aqi) return "#F1F5F9";
    if (aqi <= 50) return "#10B981";
    if (aqi <= 100) return "#F59E0B";
    if (aqi <= 150) return "#F97316";
    if (aqi <= 200) return "#EF4444";
    if (aqi <= 300) return "#8B5CF6";
    return "#7F1D1D";
  };

  const getTextColor = (aqi) => {
    if (!aqi || aqi <= 100) return "#0F172A";
    return "#FFFFFF";
  };

  const formatDateKey = (y, m, d) => {
    return `${y}-${(m + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      backgroundColor: isCompact ? "transparent" : "#FFFFFF",
      padding: isCompact ? "4px" : "20px",
      borderRadius: "16px",
      width: "100%",
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header điều hướng */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "15px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button 
            onClick={() => changeMonth(-1)}
            style={{ 
              border: "1px solid #E2E8F0", background: "#fff", borderRadius: "6px", cursor: "pointer",
              width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px", color: "#64748B", transition: "all 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            ‹
          </button>
          <span style={{ fontWeight: "800", fontSize: "14px", color: "#1E293B", minWidth: "90px", textAlign: "center" }}>
            {monthName} / {year}
          </span>
          <button 
            onClick={() => changeMonth(1)}
            style={{ 
              border: "1px solid #E2E8F0", background: "#fff", borderRadius: "6px", cursor: "pointer",
              width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px", color: "#64748B"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            ›
          </button>
        </div>
        
        {!isCompact && (
          <div style={{ display: "flex", gap: "4px" }}>
            {[50, 100, 200, 400].map(v => (
              <div key={v} style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getAqiColor(v) }} />
            ))}
          </div>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: isCompact ? "4px" : "8px",
      }}>
        {dayNames.map(day => (
          <div key={day} style={{ textAlign: "center", fontSize: "10px", fontWeight: "700", color: "#94A3B8", paddingBottom: "5px" }}>
            {day}
          </div>
        ))}

        {[...Array(startDayOffset)].map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateStr = formatDateKey(year, month, day);
          const aqi = dailyAverages[dateStr];
          const isSelected = selectedDate === dateStr;
          
          return (
            <div
              key={day}
              onClick={() => {
                if (onDateSelect) {
                  // Nếu đang chọn chính ngày này thì bỏ chọn (set về ""), ngược lại thì chọn ngày mới
                  onDateSelect(isSelected ? "" : dateStr);
                }
              }}
              style={{
                aspectRatio: "1 / 1",
                backgroundColor: getAqiColor(aqi),
                borderRadius: isCompact ? "6px" : "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
                border: isSelected ? "2px solid #3B82F6" : (aqi ? "none" : "1px dashed #E2E8F0"),
                boxShadow: isSelected ? "0 0 10px rgba(59, 130, 246, 0.4)" : "none",
                zIndex: isSelected ? 2 : 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.15)";
                e.currentTarget.style.zIndex = "10";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.zIndex = isSelected ? "2" : "1";
              }}
              title={`${dateStr}: AQI ${aqi || "N/A"}`}
            >
              <span style={{
                fontSize: isCompact ? "7px" : "9px",
                fontWeight: "700",
                color: getTextColor(aqi),
                position: "absolute",
                top: "2px",
                left: "4px",
                opacity: 0.6
              }}>
                {day}
              </span>
              {aqi && (
                <span style={{ fontSize: isCompact ? "11px" : "14px", fontWeight: "800", color: getTextColor(aqi) }}>
                  {aqi}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarHeatmap;
