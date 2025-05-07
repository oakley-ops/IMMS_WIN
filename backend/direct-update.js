require('dotenv').config();
const { Pool } = require('pg');

async function directUpdate() {
  console.log('Direct update of purchase order status');
  let pool;
  
  try {
    // Create a new pool with a single client
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'fiservinventory',
      password: process.env.DB_PASSWORD || '1234',
      ssl: false,
      max: 1 // Only use 1 client to avoid conflicts
    });
    
    // Test connection
    const testResult = await pool.query('SELECT NOW()');
    console.log('Connected to database at:', testResult.rows[0].now);
    
    // Execute the update
    console.log('Executing update for PO ID 181...');
    const updateResult = await pool.query(`
      UPDATE purchase_orders
      SET status = 'approved',
          approval_status = 'approved',
          approval_date = NOW(),
          approved_by = 'isaac.rodriguez@fiserv.com',
          notes = 'Directly updated via script',
          updated_at = NOW()
      WHERE po_id = 181
      RETURNING po_id, po_number, status, approval_status
    `);
    
    if (updateResult.rows.length === 0) {
      console.log('No rows updated. Checking if PO exists...');
      const checkResult = await pool.query('SELECT po_id, po_number, status FROM purchase_orders WHERE po_id = 181');
      
      if (checkResult.rows.length === 0) {
        console.log('No PO found with ID 181');
      } else {
        console.log('PO exists but was not updated:');
        console.log(checkResult.rows[0]);
      }
    } else {
      console.log('Update successful:');
      console.log(updateResult.rows[0]);
    }
    
    // Verify the update
    const verifyResult = await pool.query(`
      SELECT po_id, po_number, status, approval_status, approved_by
      FROM purchase_orders
      WHERE po_id = 181
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('Current status after update:');
      console.log(verifyResult.rows[0]);
    }
  } catch (error) {
    console.error('Error during direct update:', error);
  } finally {
    if (pool) {
      console.log('Closing database connection...');
      await pool.end();
      console.log('Connection closed');
    }
  }
}

// Run the update
directUpdate().catch(error => {
  console.error('Unhandled error:', error);
}); 