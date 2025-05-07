const { Pool } = require('pg');
const config = require('./src/config/database');

const pool = new Pool(config.development);

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to database');
    
    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('Query result:', result.rows[0]);
    
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    pool.end();
  }
}

testConnection(); 