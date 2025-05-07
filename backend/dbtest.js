const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool with explicit parameters
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true'
});

// Test the connection
async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Connection parameters:', {
      user: process.env.DB_USER,
      password: '[MASKED]',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true'
    });

    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    
    console.log('Testing po_email_tracking table...');
    const poResult = await pool.query('SELECT COUNT(*) FROM po_email_tracking');
    console.log('Table exists, count:', poResult.rows[0]);
  } catch (err) {
    console.error('Error connecting to database:', err);
  } finally {
    pool.end();
  }
}

testConnection(); 