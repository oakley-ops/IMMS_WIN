const { Pool } = require('pg');
require('dotenv').config();

// Default PO ID to clean up
const poIdToCleanup = process.argv[2] || 218;

async function cleanupFailedEmailAttempts() {
  console.log(`Starting cleanup of failed email attempts for PO ID: ${poIdToCleanup}`);
  
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // First check if the table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'failed_email_attempts'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Table failed_email_attempts does not exist');
      return;
    }
    
    // Check how many records we have for this PO
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM failed_email_attempts WHERE po_id = $1
    `, [poIdToCleanup]);
    
    const count = parseInt(countResult.rows[0].count);
    console.log(`Found ${count} failed email attempts for PO ID ${poIdToCleanup}`);
    
    if (count === 0) {
      console.log('No records to delete');
      return;
    }
    
    // Delete the records
    const deleteResult = await pool.query(`
      DELETE FROM failed_email_attempts WHERE po_id = $1 RETURNING *
    `, [poIdToCleanup]);
    
    console.log(`Successfully deleted ${deleteResult.rowCount} failed email attempt records for PO ID ${poIdToCleanup}`);
    console.log('You should now be able to delete the purchase order.');
    
  } catch (error) {
    console.error('Error cleaning up failed email attempts:', error);
  } finally {
    await pool.end();
  }
}

cleanupFailedEmailAttempts(); 