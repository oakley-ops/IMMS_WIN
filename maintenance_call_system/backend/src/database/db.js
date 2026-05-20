const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = require('../config/database');
const logger = require('../lib/logger');
const env = process.env.NODE_ENV || 'development';

const pool = new Pool({
  ...dbConfig[env],
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) logger.error({ err: err.message }, 'DB connection error');
  else logger.info({ now: res.rows[0].now }, 'DB connected');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
