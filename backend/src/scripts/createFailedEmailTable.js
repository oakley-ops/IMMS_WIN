const { Pool } = require('pg');
require('dotenv').config();

async function createFailedEmailTable() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS failed_email_attempts (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html_content TEXT,
        pdf_data TEXT,
        po_id INTEGER,
        po_number VARCHAR(50),
        error_message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL,
        processed_at TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
      );
    `);
    console.log('Failed email attempts table created successfully');
  } catch (error) {
    console.error('Error creating failed email attempts table:', error);
  } finally {
    await pool.end();
  }
}

createFailedEmailTable(); 