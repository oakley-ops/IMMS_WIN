require('dotenv').config();
const { Pool } = require('pg');
const emailService = require('./src/services/emailService');

// Set PO ID directly - this is for PO #202503-0001
const PO_ID = 181;

async function forceApproveAndRedirect() {
  console.log('Starting force approve and redirect process...');
  console.log('----------------------------------------');
  console.log('Environment variables:');
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('REROUTE_EMAIL:', process.env.REROUTE_EMAIL);
  console.log('----------------------------------------');
  
  let pool;
  try {
    // Connect to database
    console.log('Creating database pool...');
    pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    
    // Test database connection
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', testResult.rows[0].now);
    
    // 1. Update purchase order status directly - with more error checking
    console.log('\n1. Updating purchase order status...');
    try {
      const poResult = await pool.query(`
        UPDATE purchase_orders
        SET status = 'approved', 
            approval_status = 'approved',
            approval_date = NOW(), 
            approved_by = 'isaac.rodriguez@fiserv.com',
            notes = 'Force approved by script',
            updated_at = NOW()
        WHERE po_id = $1
        RETURNING po_id, po_number, status, approval_status
      `, [PO_ID]);
      
      if (poResult.rows.length === 0) {
        console.error('Purchase order not found');
        console.log('Checking if PO exists at all...');
        
        const checkResult = await pool.query(`
          SELECT po_id, po_number, status FROM purchase_orders WHERE po_id = $1
        `, [PO_ID]);
        
        if (checkResult.rows.length === 0) {
          console.error(`No purchase order found with ID ${PO_ID}`);
          return;
        } else {
          console.error(`PO exists but update returned no rows. Current status: ${checkResult.rows[0].status}`);
        }
        return;
      }
      
      const po = poResult.rows[0];
      console.log(`Purchase order #${po.po_number} (ID: ${po.po_id}) updated to status: ${po.status}, approval: ${po.approval_status}`);
    } catch (poUpdateError) {
      console.error('Error updating purchase order:', poUpdateError);
      throw poUpdateError;
    }
    
    // 2. Verify purchase order was updated
    console.log('\n2. Verifying purchase order update...');
    try {
      const verifyResult = await pool.query(`
        SELECT po_id, po_number, status, approval_status, approved_by 
        FROM purchase_orders
        WHERE po_id = $1
      `, [PO_ID]);
      
      if (verifyResult.rows.length === 0) {
        console.error('Could not verify purchase order update - no record found');
      } else {
        const verified = verifyResult.rows[0];
        console.log(`Verified PO #${verified.po_number}: Status=${verified.status}, Approval=${verified.approval_status}, Approved by=${verified.approved_by}`);
      }
    } catch (verifyError) {
      console.error('Error verifying PO update:', verifyError);
    }
    
    // 3. Get the most recent tracking record
    console.log('\n3. Finding tracking record...');
    let trackingRecord;
    let trackingCode;
    try {
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
      
      trackingRecord = trackingResult.rows[0];
      trackingCode = trackingRecord.tracking_code;
      console.log(`Found tracking record ID: ${trackingRecord.tracking_id}`);
      console.log(`Found tracking code: ${trackingCode}`);
      console.log(`Current status: ${trackingRecord.status}`);
    } catch (trackingError) {
      console.error('Error finding tracking record:', trackingError);
      throw trackingError;
    }
    
    // 4. Update tracking record status
    console.log('\n4. Updating tracking record status...');
    try {
      const trackingUpdateResult = await pool.query(`
        UPDATE po_email_tracking
        SET status = 'approved',
            approval_date = NOW(),
            approval_email = 'isaac.rodriguez@fiserv.com',
            notes = 'Force approved by script'
        WHERE tracking_code = $1
        RETURNING tracking_id, status
      `, [trackingCode]);
      
      if (trackingUpdateResult.rows.length === 0) {
        console.error('Tracking record update failed - no rows returned');
      } else {
        console.log('Tracking record updated successfully:');
        console.log('New status:', trackingUpdateResult.rows[0].status);
      }
    } catch (trackingUpdateError) {
      console.error('Error updating tracking record:', trackingUpdateError);
      throw trackingUpdateError;
    }
    
    // 5. Send notification email to ikerodz@gmail.com
    console.log('\n5. Sending notification email to ikerodz@gmail.com...');
    try {
      const info = await emailService.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
        to: process.env.REROUTE_EMAIL,
        subject: `Purchase Order #${PO_ID} Approved (Manual Debug)`,
        html: `
          <h2>Purchase Order #${PO_ID}</h2>
          <p>This purchase order has been manually approved via the debug script.</p>
          <p>The status has been updated in the system to "approved".</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `
      });
      
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Continue with the script, don't throw
    }
    
    // 6. Update all tracking records for this PO
    console.log('\n6. Updating all tracking records to match...');
    try {
      const bulkUpdateResult = await pool.query(`
        UPDATE po_email_tracking
        SET status = 'approved'
        WHERE po_id = $1 AND status = 'pending'
        RETURNING tracking_id
      `, [PO_ID]);
      
      console.log(`Updated ${bulkUpdateResult.rowCount} additional tracking records`);
    } catch (bulkUpdateError) {
      console.error('Error updating all tracking records:', bulkUpdateError);
      // Continue, don't throw
    }
    
    // 7. Verify final result
    console.log('\n7. Verifying final results...');
    try {
      const finalResult = await pool.query(`
        SELECT p.po_id, p.po_number, p.status, p.approval_status, p.approved_by,
              COUNT(t.tracking_id) as tracking_count
        FROM purchase_orders p
        LEFT JOIN po_email_tracking t ON p.po_id = t.po_id
        WHERE p.po_id = $1
        GROUP BY p.po_id, p.po_number, p.status, p.approval_status, p.approved_by
      `, [PO_ID]);
      
      if (finalResult.rows.length === 0) {
        console.error('Final verification failed - no record found');
      } else {
        const final = finalResult.rows[0];
        console.log('Final status:');
        console.log(`- PO #${final.po_number} (ID: ${final.po_id})`);
        console.log(`- Status=${final.status}, Approval=${final.approval_status}`);
        console.log(`- Approved by: ${final.approved_by}`);
        console.log(`- Tracking records: ${final.tracking_count}`);
      }
    } catch (finalError) {
      console.error('Error in final verification:', finalError);
    }
    
    console.log('\nProcess completed successfully');
  } catch (error) {
    console.error('Fatal error during force approve process:', error);
    console.error('Error stack:', error.stack);
  } finally {
    if (pool) {
      console.log('Closing database connection...');
      await pool.end();
      console.log('Database connection closed');
    }
  }
}

// Run the function
forceApproveAndRedirect().catch(error => {
  console.error('Unhandled error:', error);
  console.error('Stack trace:', error.stack);
}); 