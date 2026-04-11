/**
 * Mock data generator cho Air Quality API
 */

const STATIONS = [
  {
    id: "HCM-001",
    name: "Quận 1 - Bến Nghé",
    lat: 10.7769,
    lon: 106.7009,
    district: "Quận 1",
  },
  {
    id: "HCM-002",
    name: "Quận 3 - Võ Thị Sáu",
    lat: 10.7831,
    lon: 106.6917,
    district: "Quận 3",
  },
  {
    id: "HCM-003",
    name: "Bình Thạnh - Đinh Bộ Lĩnh",
    lat: 10.8142,
    lon: 106.7082,
    district: "Bình Thạnh",
  },
  {
    id: "HCM-004",
    name: "Gò Vấp - Quang Trung",
    lat: 10.8385,
    lon: 106.6655,
    district: "Gò Vấp",
  },
  {
    id: "HCM-005",
    name: "Tân Bình - Hoàng Văn Thụ",
    lat: 10.8016,
    lon: 106.6524,
    district: "Tân Bình",
  },
  {
    id: "HCM-006",
    name: "Quận 7 - Phú Mỹ Hưng",
    lat: 10.7317,
    lon: 106.7214,
    district: "Quận 7",
  },
];

const POLLUTANTS = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"];

const AQI_CATEGORIES = [
  {
    range: [0, 50],
    label: "Tốt",
    color: "#00e400",
    description: "Chất lượng không khí tốt",
  },
  {
    range: [51, 100],
    label: "Trung bình",
    color: "#ffff00",
    description: "Chất lượng không khí chấp nhận được",
  },
  {
    range: [101, 150],
    label: "Kém",
    color: "#ff7e00",
    description: "Không tốt cho nhóm nhạy cảm",
  },
  {
    range: [151, 200],
    label: "Xấu",
    color: "#ff0000",
    description: "Không tốt cho sức khỏe",
  },
  {
    range: [201, 300],
    label: "Rất xấu",
    color: "#8f3f97",
    description: "Cảnh báo sức khỏe nghiêm trọng",
  },
  {
    range: [301, 500],
    label: "Nguy hiểm",
    color: "#7e0023",
    description: "Tình trạng khẩn cấp về sức khỏe",
  },
];

function getAqiCategory(aqi) {
  return (
    AQI_CATEGORIES.find((c) => aqi >= c.range[0] && aqi <= c.range[1]) ||
    AQI_CATEGORIES[0]
  );
}

function randomBetween(min, max, decimals = 1) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

// Mô phỏng AQI thay đổi theo giờ trong ngày (cao vào giờ cao điểm)
function getHourlyBias(hour) {
  // Giờ cao điểm sáng: 7-9h, chiều: 17-19h
  if (hour >= 7 && hour <= 9) return 1.4;
  if (hour >= 17 && hour <= 19) return 1.5;
  if (hour >= 0 && hour <= 5) return 0.7;
  return 1.0;
}

function generateAqi(baseAqi, hour) {
  const bias = getHourlyBias(hour);
  const noise = randomBetween(-8, 8, 0);
  return Math.max(10, Math.min(300, Math.round(baseAqi * bias + noise)));
}

/**
 * Tạo một bản ghi đo lường tại một thời điểm
 */
function generateMeasurement(stationId, timestamp, baseAqi = 85) {
  const hour = new Date(timestamp).getHours();
  const aqi = generateAqi(baseAqi, hour);
  const category = getAqiCategory(aqi);

  return {
    station_id: stationId,
    timestamp,
    aqi,
    category: category.label,
    color: category.color,
    pollutants: {
      "PM2.5": randomBetween(5, 80, 1),
      PM10: randomBetween(10, 120, 1),
      NO2: randomBetween(5, 60, 1),
      SO2: randomBetween(1, 30, 1),
      CO: randomBetween(0.2, 5, 2),
      O3: randomBetween(10, 80, 1),
    },
    temperature: randomBetween(26, 36, 1),
    humidity: randomBetween(55, 95, 1),
    wind_speed: randomBetween(0, 15, 1),
  };
}

module.exports = {
  STATIONS,
  POLLUTANTS,
  AQI_CATEGORIES,
  getAqiCategory,
  generateMeasurement,
  randomBetween,
};
