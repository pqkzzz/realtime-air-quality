const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) return null;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.delete('sslrootcert');
  return url.toString();
}

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'realtime_air_quality',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, 'migrations')
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL
      ? {
          connectionString: getDatabaseUrl(),
          ssl: { rejectUnauthorized: false }
        }
      : {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT || 5432,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          ssl: { rejectUnauthorized: false }
        },
    pool: {
      min: 0,
      max: 5
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, 'migrations')
    }
  }
};
