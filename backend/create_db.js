const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const knex = require('knex');

const config = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default database
  }
};

const dbName = process.env.DB_NAME || 'realtime_air_quality';

async function createDatabase() {
  const db = knex(config);
  try {
    console.log(`Checking if database "${dbName}" exists...`);
    const result = await db.raw(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    
    if (result.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await db.raw(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error creating database:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

createDatabase();
