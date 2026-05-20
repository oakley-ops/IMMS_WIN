require('dotenv').config();

module.exports = {
  development: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'fiservinventory',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
  production: {
    connectionString: process.env.DATABASE_URL,
    // Only allow self-signed certs if DB_SSL_INSECURE=true is explicitly set
    // (e.g. some managed Postgres providers require it). Defaults to strict
    // verification, which is what production should normally do.
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' }
      : false,
  },
};
