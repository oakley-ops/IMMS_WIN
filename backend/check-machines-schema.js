const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imms_inventory',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'machines' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nMachines table columns:');
    console.log('------------------------');
    result.rows.forEach(row => {
      console.log(`${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
