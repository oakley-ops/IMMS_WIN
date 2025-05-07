const { Pool } = require('pg');
require('dotenv').config();

// Import database config
const dbConfig = require('../config/database');

// Determine which environment we're in
const environment = process.env.NODE_ENV || 'development';
const config = dbConfig[environment];

// Log database configuration (without password)
console.log('Database configuration:', {
  hasConnectionString: !!config.connectionString,
  nodeEnv: process.env.NODE_ENV,
  ssl: process.env.DB_SSL || 'disabled',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Create a PostgreSQL connection pool
const pool = new Pool({
  ...config,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to database:', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
}; 