require('dotenv').config();
const { Pool } = require('pg');
const emailService = require('./src/services/emailService');

// Set PO ID directly - this is for PO #202503-0001
const PO_ID = 181;

async function forceApproveAndRedirect() {
  console.log('Starting force approve and redirect process...');
  
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
    
    // 1. Update purchase order status directly
    console.log('Updating purchase order status...');
    const poResult = await pool.query(`
      UPDATE purchase_orders
      SET status = 'approved', 
          approval_status = 'approved',
          approval_date = NOW(), 
          approved_by = 'isaac.rodriguez@fiserv.com',
          notes = 'Force approved by script'
      WHERE po_id = $1
      RETURNING po_number, status, approval_status
    `, [PO_ID]);
    
    if (poResult.rows.length === 0) {
      console.error('Purchase order not found');
      return;
    }
    
    const po = poResult.rows[0];
    console.log(`Purchase order #${po.po_number} updated to status: ${po.status}, approval: ${po.approval_status}`);
    
    // 2. Get the most recent tracking record
    console.log('Finding tracking record...');
    const trackingResult = await pool.query(`
      SELECT * FROM po_email_tracking
      WHERE po_id = $1
      ORDER BY sent_date DESC
      LIMIT 1
    `, [PO_ID]);
    
    if (trackingResult.rows.length === 0) {
      console.error('No tracking record found');
      return;
    }
    
    const trackingRecord = trackingResult.rows[0];
    const trackingCode = trackingRecord.tracking_code;
    console.log(`Found tracking code: ${trackingCode}`);
    
    // 3. Update tracking record status
    console.log('Updating tracking record status...');
    await pool.query(`
      UPDATE po_email_tracking
      SET status = 'approved',
          approval_date = NOW(),
          approval_email = 'isaac.rodriguez@fiserv.com',
          notes = 'Force approved by script'
      WHERE tracking_code = $1
    `, [trackingCode]);
    
    console.log('Tracking record updated successfully');
    
    // 6. Update all tracking records for this PO
    console.log('Updating all tracking records to match...');
    await pool.query(`
      UPDATE po_email_tracking
      SET status = 'approved'
      WHERE po_id = $1 AND status = 'pending'
    `, [PO_ID]);
    
    console.log('All tracking records updated');
    
    // 7. Verify final result
    console.log('\nVerifying results...');
    const finalResult = await pool.query(`
      SELECT p.po_number, p.status, p.approval_status, p.approved_by,
             COUNT(t.tracking_id) as tracking_count
      FROM purchase_orders p
      LEFT JOIN po_email_tracking t ON p.po_id = t.po_id
      WHERE p.po_id = $1
      GROUP BY p.po_id, p.po_number, p.status, p.approval_status, p.approved_by
    `, [PO_ID]);
    
    const final = finalResult.rows[0];
    console.log('Final status:');
    console.log(`- PO #${final.po_number}: Status=${final.status}, Approval=${final.approval_status}`);
    console.log(`- Approved by: ${final.approved_by}`);
    console.log(`- Tracking records: ${final.tracking_count}`);
    
    await pool.end();
    console.log('Process completed successfully');
  } catch (error) {
    console.error('Error during force approve process:', error);
  }
}

forceApproveAndRedirect().catch(console.error); 