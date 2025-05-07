require('dotenv').config();
const { Pool } = require('pg');
const emailTrackingService = require('../services/emailTrackingService');

async function fixPurchaseOrderStatus() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Get all POs with pending status but approved email tracking
    const result = await pool.query(`
      SELECT 
        po.po_id,
        po.po_number,
        po.status as po_status,
        po.approval_status,
        et.status as tracking_status,
        et.approval_date,
        et.approval_email,
        et.tracking_code
      FROM purchase_orders po
      JOIN po_email_tracking et ON po.po_id = et.po_id
      WHERE et.status = 'approved'
      AND (po.status != 'approved' OR po.approval_status != 'approved')
      ORDER BY et.approval_date DESC
    `);

    console.log(`Found ${result.rows.length} POs that need status fixing`);

    for (const record of result.rows) {
      console.log(`\nProcessing PO #${record.po_number} (ID: ${record.po_id})`);
      console.log(`Current status: PO Status=${record.po_status}, Approval Status=${record.approval_status}`);
      console.log(`Email tracking status: ${record.tracking_status}`);

      // Update the purchase order status
      await pool.query(`
        UPDATE purchase_orders
        SET status = 'approved',
            approval_status = 'approved',
            approval_date = $1,
            approved_by = $2,
            updated_at = NOW()
        WHERE po_id = $3
      `, [record.approval_date, record.approval_email, record.po_id]);

      console.log('Updated PO status to approved');

      // Emit socket events to update the frontend
      if (global.io) {
        global.io.emit('purchase_order_update', {
          po_id: record.po_id,
          status: 'approved',
          approval_status: 'approved'
        });
        console.log('Emitted socket event for frontend update');
      }
    }

    console.log('\nStatus fix completed');
  } catch (error) {
    console.error('Error fixing PO statuses:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPurchaseOrderStatus().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 