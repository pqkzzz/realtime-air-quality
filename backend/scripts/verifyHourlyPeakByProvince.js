/**
 * Verify whether the 17:00-20:00 AQI risk window applies evenly by province.
 *
 * Usage:
 *   node scripts/verifyHourlyPeakByProvince.js
 *
 * Optional env vars:
 *   START_DATE=2026-05-01
 *   END_DATE=2026-05-30
 *   EVENING_LIFT_THRESHOLD=10
 *   AQI_THRESHOLD=100
 */

const db = require("../configs/db");

const START_DATE = process.env.START_DATE || "2026-05-01";
const END_DATE = process.env.END_DATE || "2026-05-30";
const EVENING_START_HOUR = 17;
const EVENING_END_HOUR = 20;
const EVENING_LIFT_THRESHOLD = Number(process.env.EVENING_LIFT_THRESHOLD || 10);
const AQI_THRESHOLD = Number(process.env.AQI_THRESHOLD || 100);

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(part, total) {
  if (!total) return null;
  return round((part / total) * 100, 2);
}

function isEveningHour(hour) {
  return hour >= EVENING_START_HOUR && hour <= EVENING_END_HOUR;
}

function toAsciiText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function formatCell(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  if (value == null) return "";
  if (typeof value === "string") return toAsciiText(value);
  return String(value);
}

function getRiskBucket(peakHour) {
  if (isEveningHour(peakHour)) return "17-20";
  if (peakHour >= 14 && peakHour <= 16) return "14-16";
  if (peakHour >= 21 || peakHour <= 5) return "21-05";
  if (peakHour >= 7 && peakHour <= 9) return "07-09";
  return "other";
}

function buildStationStats(station, readings) {
  const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
    const hourlyAqi = readings
      .filter((reading) => reading.hour === hour)
      .map((reading) => reading.aqi);

    return {
      hour,
      avgAqi: mean(hourlyAqi),
      exceedPct: percent(
        hourlyAqi.filter((value) => value >= AQI_THRESHOLD).length,
        hourlyAqi.length,
      ),
      count: hourlyAqi.length,
    };
  });

  const peak = hourlyStats
    .filter((item) => item.count > 0)
    .sort((a, b) => b.avgAqi - a.avgAqi)[0];

  const eveningAqi = readings
    .filter((reading) => isEveningHour(reading.hour))
    .map((reading) => reading.aqi);
  const nonEveningAqi = readings
    .filter((reading) => !isEveningHour(reading.hour))
    .map((reading) => reading.aqi);

  const eveningAvg = mean(eveningAqi);
  const nonEveningAvg = mean(nonEveningAqi);
  const eveningLift = eveningAvg - nonEveningAvg;

  return {
    station,
    totalAvgAqi: round(mean(readings.map((reading) => reading.aqi))),
    peakHour: peak.hour,
    peakHourAvgAqi: round(peak.avgAqi),
    peakHourExceedPct: peak.exceedPct,
    peakBucket: getRiskBucket(peak.hour),
    eveningAvgAqi: round(eveningAvg),
    nonEveningAvgAqi: round(nonEveningAvg),
    eveningLift: round(eveningLift),
    eveningExceedPct: percent(
      eveningAqi.filter((value) => value >= AQI_THRESHOLD).length,
      eveningAqi.length,
    ),
    isPeakInEvening: isEveningHour(peak.hour),
    hasStrongEveningSignal: eveningLift >= EVENING_LIFT_THRESHOLD,
  };
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("(no rows)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((column) =>
    Math.max(
      column.length,
      ...rows.map((row) => formatCell(row[column]).length),
    ),
  );

  const divider = `+-${widths.map((width) => "-".repeat(width)).join("-+-")}-+`;
  const formatRow = (values) =>
    `| ${values
      .map((value, index) => formatCell(value).padEnd(widths[index]))
      .join(" | ")} |`;

  console.log(divider);
  console.log(formatRow(columns));
  console.log(divider);
  rows.forEach((row) => console.log(formatRow(columns.map((column) => row[column]))));
  console.log(divider);
}

async function main() {
  const rows = await db("air_quality_readings")
    .select("station_name", "aqi")
    .select(
      db.raw(
        "extract(hour from measured_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int as hour",
      ),
    )
    .whereRaw(
      "(measured_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date between ?::date and ?::date",
      [START_DATE, END_DATE],
    )
    .orderBy("station_name")
    .orderBy("hour");

  if (!rows.length) {
    console.log(`No data found from ${START_DATE} to ${END_DATE}.`);
    return;
  }

  const readingsByStation = new Map();
  rows.forEach((row) => {
    if (!readingsByStation.has(row.station_name)) {
      readingsByStation.set(row.station_name, []);
    }
    readingsByStation.get(row.station_name).push({
      hour: Number(row.hour),
      aqi: Number(row.aqi),
    });
  });

  const stationStats = Array.from(readingsByStation.entries())
    .map(([station, readings]) => buildStationStats(station, readings))
    .sort((a, b) => b.totalAvgAqi - a.totalAvgAqi);

  const peakBuckets = stationStats.reduce((acc, station) => {
    acc[station.peakBucket] = (acc[station.peakBucket] || 0) + 1;
    return acc;
  }, {});

  const peakInEvening = stationStats.filter((item) => item.isPeakInEvening);
  const strongEvening = stationStats.filter((item) => item.hasStrongEveningSignal);
  const nonEveningPeaks = stationStats.filter((item) => !item.isPeakInEvening);

  console.log("Hourly AQI peak verification by province");
  console.log(`Date range: ${START_DATE} to ${END_DATE} (Asia/Ho_Chi_Minh date)`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Stations: ${stationStats.length}`);
  console.log(`AQI threshold: ${AQI_THRESHOLD}`);
  console.log(
    `Strong evening signal: evening AQI - non-evening AQI >= ${EVENING_LIFT_THRESHOLD}`,
  );

  console.log("\nSummary");
  printTable("Summary table", [
    {
      metric: "Stations with peak hour in 17-20",
      value: `${peakInEvening.length}/${stationStats.length}`,
    },
    {
      metric: "Stations with strong evening signal",
      value: `${strongEvening.length}/${stationStats.length}`,
    },
    {
      metric: "Stations with peak outside 17-20",
      value: `${nonEveningPeaks.length}/${stationStats.length}`,
    },
  ]);
  console.log(
    "Peak-hour bucket counts:",
    Object.entries(peakBuckets)
      .map(([bucket, count]) => `${bucket}=${count}`)
      .join(", "),
  );

  printTable(
    "Stations with strong 17-20 signal",
    strongEvening.map((item) => ({
      station: item.station,
      avg_aqi: item.totalAvgAqi,
      peak_hour: item.peakHour,
      evening_lift: item.eveningLift,
      evening_exceed_pct: item.eveningExceedPct,
    })),
  );

  printTable(
    "Stations whose peak hour is NOT 17-20",
    nonEveningPeaks.map((item) => ({
      station: item.station,
      avg_aqi: item.totalAvgAqi,
      peak_hour: item.peakHour,
      peak_hour_avg_aqi: item.peakHourAvgAqi,
      evening_avg_aqi: item.eveningAvgAqi,
      evening_lift: item.eveningLift,
    })),
  );

  printTable(
    "All station results",
    stationStats.map((item) => ({
      station: item.station,
      avg_aqi: item.totalAvgAqi,
      peak_hour: item.peakHour,
      peak_bucket: item.peakBucket,
      peak_hour_avg_aqi: item.peakHourAvgAqi,
      evening_avg_aqi: item.eveningAvgAqi,
      non_evening_avg_aqi: item.nonEveningAvgAqi,
      evening_lift: item.eveningLift,
      evening_exceed_pct: item.eveningExceedPct,
      strong_evening: item.hasStrongEveningSignal,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
