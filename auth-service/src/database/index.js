// src/database/index.js
const { Pool } = require('pg');
const configs = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const pool = new Pool(configs[env] || configs.development);

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected pg pool error:', err);
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
