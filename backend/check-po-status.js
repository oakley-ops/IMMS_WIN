require('dotenv').config();
const { Pool } = require('pg');

async function checkPOStatus() {
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
    
    // Check purchase order statuses
    console.log('Checking purchase order statuses...');
    const poResult = await pool.query(`
      SELECT po_id, po_number, status, approval_status, approval_date, approved_by 
      FROM purchase_orders
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log('Recent purchase orders:');
    poResult.rows.forEach(po => {
      console.log(`PO #${po.po_number} (ID: ${po.po_id}): Status=${po.status}, Approval=${po.approval_status}, Approved by ${po.approved_by || 'none'} on ${po.approval_date || 'N/A'}`);
    });
    
    // Check tracking records
    console.log('\nChecking email tracking records...');
    const trackingResult = await pool.query(`
      SELECT t.*, p.po_number 
      FROM po_email_tracking t
      JOIN purchase_orders p ON t.po_id = p.po_id
      ORDER BY t.sent_date DESC
      LIMIT 10
    `);
    
    console.log('Recent tracking records:');
    trackingResult.rows.forEach(record => {
      console.log(`Tracking Code: ${record.tracking_code}, PO #${record.po_number} (ID: ${record.po_id})`);
      console.log(`  Status: ${record.status}, Recipient: ${record.recipient_email}, Approval: ${record.approval_email || 'none'} on ${record.approval_date || 'N/A'}`);
      console.log(`  Rerouted: ${record.rerouted_to ? `Yes, to ${record.rerouted_to}` : 'No'}`);
      console.log('---');
    });
    
    // Check specific approval email tracking
    console.log('\nChecking for isaac.rodriguez@fiserv.com approvals...');
    const approvalResult = await pool.query(`
      SELECT t.*, p.po_number 
      FROM po_email_tracking t
      JOIN purchase_orders p ON t.po_id = p.po_id
      WHERE lower(t.approval_email) = lower('isaac.rodriguez@fiserv.com')
      ORDER BY t.approval_date DESC
      LIMIT 10
    `);
    
    if (approvalResult.rows.length === 0) {
      console.log('No approvals found from isaac.rodriguez@fiserv.com');
    } else {
      console.log(`Found ${approvalResult.rows.length} approvals from isaac.rodriguez@fiserv.com:`);
      approvalResult.rows.forEach((record, i) => {
        console.log(`${i+1}. PO #${record.po_number} - Status: ${record.status} - Code: ${record.tracking_code}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error checking statuses:', error);
  }
}

checkPOStatus().catch(console.error); 