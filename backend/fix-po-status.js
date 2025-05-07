require('dotenv').config();
const { Pool } = require('pg');

async function fixPurchaseOrderStatus() {
  try {
    // Connect to database
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Get all approved tracking records that don't have matching PO status
    console.log('Finding tracking records with approved status...');
    const result = await pool.query(`
      SELECT t.*, p.po_number, p.status as po_status, p.approval_status 
      FROM po_email_tracking t
      JOIN purchase_orders p ON t.po_id = p.po_id
      WHERE t.status = 'approved' 
      AND (p.status != 'approved' OR p.approval_status != 'approved' OR p.approval_status IS NULL)
    `);
    
    if (result.rows.length === 0) {
      console.log('No mismatched records found. All approved tracking records match their PO status.');
      return;
    }
    
    console.log(`Found ${result.rows.length} approved tracking records with mismatched PO status:`);
    for (const record of result.rows) {
      console.log(`PO #${record.po_number} (ID: ${record.po_id}) - Tracking Status: ${record.status}, PO Status: ${record.po_status}, PO Approval Status: ${record.approval_status || 'NULL'}`);
      
      // Update purchase order status to match tracking record
      console.log(`  - Updating PO status to 'approved'...`);
      const updateResult = await pool.query(`
        UPDATE purchase_orders
        SET status = 'approved', 
            approval_status = 'approved',
            approval_date = $1, 
            approved_by = $2,
            updated_at = NOW()
        WHERE po_id = $3
        RETURNING po_id, status, approval_status
      `, [record.approval_date || new Date(), record.approval_email, record.po_id]);
      
      console.log(`  - Update complete. New status: ${updateResult.rows[0].status}, Approval status: ${updateResult.rows[0].approval_status}`);
      
      console.log('---');
    }
    
    // Verify the fixes
    console.log('\nVerifying database status after fixes...');
    const verifyResult = await pool.query(`
      SELECT t.po_id, t.status as tracking_status, t.approval_email, 
             p.po_number, p.status as po_status, p.approval_status, p.approved_by
      FROM po_email_tracking t
      JOIN purchase_orders p ON t.po_id = p.po_id
      WHERE t.status = 'approved'
      ORDER BY t.approval_date DESC
    `);
    
    console.log('Current status of approved tracking records:');
    verifyResult.rows.forEach(row => {
      console.log(`PO #${row.po_number} (ID: ${row.po_id}) - Tracking Status: ${row.tracking_status}, PO Status: ${row.po_status}, PO Approval Status: ${row.approval_status || 'NULL'}, Approved by: ${row.approved_by || 'none'}`);
    });
    
    await pool.end();
    console.log('\nDatabase connection closed. Status fix complete.');
  } catch (error) {
    console.error('Error fixing purchase order status:', error);
  }
}

// Run the function
fixPurchaseOrderStatus().catch(console.error); 