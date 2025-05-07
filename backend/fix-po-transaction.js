require('dotenv').config();
const { Pool } = require('pg');
const emailService = require('./src/services/emailService');

// Set PO ID directly - this is for PO #202503-0002
const PO_ID = 184;

async function fixPOTransaction() {
  console.log('Starting PO transaction fix process...');
  
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'fiservinventory',
    password: '1234',
    ssl: false
  });

  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    console.log('Transaction started');

    // 1. Update purchase order status
    console.log('Updating purchase order status...');
    const poResult = await client.query(`
      UPDATE purchase_orders
      SET status = 'approved',
          approval_status = 'approved',
          approval_date = NOW(),
          approved_by = 'isaac.rodriguez@fiserv.com',
          notes = 'Fixed via transaction script'
      WHERE po_id = $1
      RETURNING po_id, po_number, status, approval_status
    `, [PO_ID]);

    if (poResult.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const po = poResult.rows[0];
    console.log('PO update result:', po);

    // 2. Update tracking records
    console.log('Updating tracking records...');
    const trackingResult = await client.query(`
      UPDATE po_email_tracking
      SET status = 'approved',
          approval_date = NOW(),
          approval_email = 'isaac.rodriguez@fiserv.com',
          notes = 'Fixed via transaction script'
      WHERE po_id = $1
      RETURNING tracking_code, status
    `, [PO_ID]);

    console.log('Tracking records updated:', trackingResult.rows);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Transaction committed successfully');

    // 3. Send notification email
    console.log('Sending notification email...');
    try {
      const info = await emailService.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
        to: process.env.REROUTE_EMAIL || 'ikerodz@gmail.com',
        subject: `Purchase Order #${po.po_number} Status Fixed`,
        html: `
          <h2>Purchase Order #${po.po_number}</h2>
          <p>This purchase order's status has been fixed to "approved" via the transaction fix script.</p>
          <p>Current status: ${po.status}</p>
          <p>Approval status: ${po.approval_status}</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `
      });
      console.log('Notification email sent:', info.messageId);
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Don't throw here since the DB transaction was successful
    }

    // 4. Verify final state
    const verifyResult = await client.query(`
      SELECT po.po_id, po.po_number, po.status, po.approval_status, po.approved_by,
             COUNT(pet.tracking_id) as tracking_count,
             COUNT(CASE WHEN pet.status = 'approved' THEN 1 END) as approved_count
      FROM purchase_orders po
      LEFT JOIN po_email_tracking pet ON po.po_id = pet.po_id
      WHERE po.po_id = $1
      GROUP BY po.po_id, po.po_number, po.status, po.approval_status, po.approved_by
    `, [PO_ID]);

    console.log('\nFinal verification:');
    console.log(verifyResult.rows[0]);

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error in transaction:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
    await pool.end();
  }
}

// Run the fix
fixPOTransaction().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 