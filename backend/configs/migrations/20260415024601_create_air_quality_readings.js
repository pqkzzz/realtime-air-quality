exports.up = function (knex) {
  return knex.schema.createTable("air_quality_readings", (table) => {
    table.increments("id").primary();

    // Thông tin trạm đo
    table.string("station_id", 20).notNullable();
    table.string("station_name", 100).notNullable();
    table.string("district", 50).notNullable();
    table.decimal("lat", 9, 6).notNullable();
    table.decimal("lon", 9, 6).notNullable();

    // Thời điểm đo
    table.timestamp("measured_at", { useTz: true }).notNullable();

    // AQI
    table.integer("aqi").nullable();
    table.string("aqi_category", 30).nullable();

    // Chất ô nhiễm (µg/m³, trừ co = mg/m³)
    table.decimal("pm2_5", 8, 2).nullable();
    table.decimal("pm10", 8, 2).nullable();
    table.decimal("no2", 8, 2).nullable();
    table.decimal("so2", 8, 2).nullable();
    table.decimal("co", 8, 2).nullable();
    table.decimal("o3", 8, 2).nullable();
    table.decimal("dust", 8, 2).nullable();
    table.decimal("uv_index", 5, 2).nullable();

    // Metadata
    table.string("source", 30).defaultTo("open-meteo");
    table.timestamp("fetched_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamps(true, true);

    // Indexes
    table.index(["station_id", "measured_at"], "idx_station_measured_at");
    table.index("measured_at", "idx_measured_at");
    table.index("aqi", "idx_aqi");

    // Unique constraint: mỗi trạm chỉ có 1 record / 1 giờ
    table.unique(["station_id", "measured_at"], "uq_station_measured_at");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("air_quality_readings");
};
