const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function up() {
  const client = await pool.connect();
  try {
    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, '20240320_create_po_email_tracking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('Successfully created po_email_tracking table and updated purchase_orders');
  } catch (error) {
    console.error('Error in migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS po_email_tracking;
      
      ALTER TABLE purchase_orders
      DROP COLUMN IF EXISTS approval_status,
      DROP COLUMN IF EXISTS approval_date,
      DROP COLUMN IF EXISTS approval_email;
    `);
    console.log('Successfully rolled back po_email_tracking changes');
  } catch (error) {
    console.error('Error in rollback:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
up().catch(console.error).finally(() => pool.end()); 