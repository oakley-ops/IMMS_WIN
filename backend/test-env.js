// Load environment variables
require('dotenv').config();

// Print loaded environment variables
console.log('Environment variables loaded:', {
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_SSL: process.env.DB_SSL,
  DATABASE_URL: process.env.DATABASE_URL,
  IMAP_USER: process.env.IMAP_USER,
  IMAP_PASSWORD: process.env.IMAP_PASSWORD,
  IMAP_HOST: process.env.IMAP_HOST,
  IMAP_PORT: process.env.IMAP_PORT
}); 