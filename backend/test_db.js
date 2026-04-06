const db = require('./configs/db');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await db.raw('SELECT 1+1 AS result');
    console.log('Database connection successful!');
    console.log('Result:', result.rows[0].result);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
