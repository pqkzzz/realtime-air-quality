exports.up = function (knex) {
  return knex.schema.createTable("air_quality_forecasts", (table) => {
    table.increments("id").primary();

    // Thông tin trạm đo
    table.string("station_id", 20).notNullable();

    // Ngày dự báo
    table.date("forecast_date").notNullable();

    // AQI dự báo (max trong ngày)
    table.integer("aqi").nullable();
    table.string("aqi_category", 30).nullable();

    // Chất ô nhiễm dự báo (max trong ngày)
    table.decimal("pm2_5", 8, 2).nullable();
    table.decimal("pm10", 8, 2).nullable();

    // Metadata
    table.timestamp("fetched_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamps(true, true);

    // Indexes
    table.index(["station_id", "forecast_date"], "idx_forecast_station_date");
    table.index("forecast_date", "idx_forecast_date");

    // Unique constraint: mỗi trạm chỉ có 1 record dự báo cho 1 ngày
    table.unique(["station_id", "forecast_date"], "uq_forecast_station_date");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("air_quality_forecasts");
};
