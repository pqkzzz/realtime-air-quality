/**
 * Mock data generator cho Air Quality API
 */

const STATIONS = [
  {
    id: "VN-01",
    name: "Tuyên Quang",
    district: "Tuyên Quang",
    lat: 21.8219,
    lon: 105.2155,
  },
  {
    id: "VN-02",
    name: "Cao Bằng",
    district: "Cao Bằng",
    lat: 22.6738,
    lon: 106.257,
  },
  {
    id: "VN-03",
    name: "Lai Châu",
    district: "Lai Châu",
    lat: 22.392,
    lon: 103.4619,
  },
  {
    id: "VN-04",
    name: "Lào Cai",
    district: "Lào Cai",
    lat: 22.4839,
    lon: 103.9749,
  },
  {
    id: "VN-05",
    name: "Thái Nguyên",
    district: "Thái Nguyên",
    lat: 21.5942,
    lon: 105.8482,
  },
  {
    id: "VN-06",
    name: "Điện Biên",
    district: "Điện Biên",
    lat: 21.386,
    lon: 103.018,
  },
  {
    id: "VN-07",
    name: "Lạng Sơn",
    district: "Lạng Sơn",
    lat: 21.8504,
    lon: 106.7588,
  },
  {
    id: "VN-08",
    name: "Sơn La",
    district: "Sơn La",
    lat: 21.3283,
    lon: 103.9048,
  },
  {
    id: "VN-09",
    name: "Phú Thọ",
    district: "Phú Thọ",
    lat: 21.3262,
    lon: 105.2146,
  },
  {
    id: "VN-10",
    name: "Hà Nội",
    district: "Hà Nội",
    lat: 21.0285,
    lon: 105.8542,
  },
  {
    id: "VN-11",
    name: "Hải Phòng",
    district: "Hải Phòng",
    lat: 20.8449,
    lon: 106.6881,
  },
  {
    id: "VN-12",
    name: "Bắc Ninh",
    district: "Bắc Ninh",
    lat: 21.1861,
    lon: 106.0763,
  },
  {
    id: "VN-13",
    name: "Quảng Ninh",
    district: "Quảng Ninh",
    lat: 20.9505,
    lon: 107.0734,
  },
  {
    id: "VN-14",
    name: "Hưng Yên",
    district: "Hưng Yên",
    lat: 20.6464,
    lon: 106.0511,
  },
  {
    id: "VN-15",
    name: "Ninh Bình",
    district: "Ninh Bình",
    lat: 20.2541,
    lon: 105.9783,
  },
  {
    id: "VN-16",
    name: "Thanh Hóa",
    district: "Thanh Hóa",
    lat: 19.8056,
    lon: 105.7766,
  },
  {
    id: "VN-17",
    name: "Nghệ An",
    district: "Nghệ An",
    lat: 18.6733,
    lon: 105.6813,
  },
  {
    id: "VN-18",
    name: "Hà Tĩnh",
    district: "Hà Tĩnh",
    lat: 18.3414,
    lon: 105.9049,
  },
  {
    id: "VN-19",
    name: "Quảng Trị",
    district: "Quảng Trị",
    lat: 16.8118,
    lon: 107.1009,
  },
  { id: "VN-20", name: "Huế", district: "Huế", lat: 16.4637, lon: 107.5909 },
  {
    id: "VN-21",
    name: "Đà Nẵng",
    district: "Đà Nẵng",
    lat: 16.0544,
    lon: 108.2022,
  },
  {
    id: "VN-22",
    name: "Quảng Ngãi",
    district: "Quảng Ngãi",
    lat: 15.1205,
    lon: 108.7923,
  },
  {
    id: "VN-23",
    name: "Gia Lai",
    district: "Gia Lai",
    lat: 13.9808,
    lon: 108.0003,
  },
  {
    id: "VN-24",
    name: "Đắk Lắk",
    district: "Đắk Lắk",
    lat: 12.6667,
    lon: 108.0382,
  },
  {
    id: "VN-25",
    name: "Khánh Hòa",
    district: "Khánh Hòa",
    lat: 12.2451,
    lon: 109.1943,
  },
  {
    id: "VN-26",
    name: "Lâm Đồng",
    district: "Lâm Đồng",
    lat: 11.9404,
    lon: 108.4583,
  },
  {
    id: "VN-27",
    name: "Đồng Nai",
    district: "Đồng Nai",
    lat: 10.9488,
    lon: 106.8202,
  },
  {
    id: "VN-28",
    name: "Tây Ninh",
    district: "Tây Ninh",
    lat: 11.3113,
    lon: 106.0984,
  },
  {
    id: "VN-29",
    name: "Hồ Chí Minh",
    district: "Hồ Chí Minh",
    lat: 10.7626,
    lon: 106.6601,
  },
  {
    id: "VN-30",
    name: "Đồng Tháp",
    district: "Đồng Tháp",
    lat: 10.2898,
    lon: 105.98,
  },
  {
    id: "VN-31",
    name: "An Giang",
    district: "An Giang",
    lat: 10.3759,
    lon: 105.4338,
  },
  {
    id: "VN-32",
    name: "Vĩnh Long",
    district: "Vĩnh Long",
    lat: 10.2548,
    lon: 105.962,
  },
  {
    id: "VN-33",
    name: "Cần Thơ",
    district: "Cần Thơ",
    lat: 10.0452,
    lon: 105.7469,
  },
  { id: "VN-34", name: "Cà Mau", district: "Cà Mau", lat: 9.1769, lon: 105.15 },
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
