require('dotenv').config();

module.exports = {
  development: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'fiservinventory',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: false
  },
  // production: {
  //   connectionString: process.env.DATABASE_URL,
  //   ssl: false,
  //   statement_timeout: 10000,
  //   query_timeout: 10000,
  //   connectionTimeoutMillis: 10000,
  //   idle_in_transaction_session_timeout: 10000
  // }
};
