const { Pool } = require('pg');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const config = require('../config/database')[env];

let pool;
let retries = 5;
const retryInterval = 5000; // 5 seconds

const createPool = async () => {
  try {
    console.log('Creating database pool with environment:', env);
    
    const poolConfig = {
      ...config,
      ssl: false
    };

    // Log connection attempt (without sensitive data)
    console.log('Attempting database connection with config:', {
      ...poolConfig,
      connectionString: poolConfig.connectionString ? '[REDACTED]' : undefined,
      password: '[REDACTED]'
    });

    pool = new Pool(poolConfig);

    // Add error handler for unexpected errors
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        detail: err.detail
      });
    });

    // Test database connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully at:', result.rows[0].now);
    return pool;
  } catch (error) {
    console.error('Error creating database pool:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });

    if (retries > 0) {
      console.log(`Retrying connection... ${retries} attempts remaining`);
      retries--;
      setTimeout(createPool, retryInterval);
    } else {
      console.error('Max retries reached. Exiting...');
      process.exit(-1);
    }
  }
};

// Initialize the pool
createPool();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
