const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/20260620_create_search_documents.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('✅ search_documents table + pg_trgm extension created');
  } catch (e) {
    console.error('❌ failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
