require('dotenv').config();
const { Pool } = require('pg');
const emailTrackingService = require('./src/services/emailTrackingService');
const emailService = require('./src/services/emailService');

async function manuallyApproveOrder() {
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
    
    // Get the most recent tracking record - use a specific code if needed
    const trackingCode = process.argv[2] || null;
    let trackingRecord;
    
    if (trackingCode) {
      console.log(`Looking up tracking code: ${trackingCode}`);
      const result = await pool.query(`
        SELECT t.*, p.po_number 
        FROM po_email_tracking t
        JOIN purchase_orders p ON t.po_id = p.po_id
        WHERE t.tracking_code = $1
      `, [trackingCode]);
      
      if (result.rows.length === 0) {
        console.error(`No tracking record found with code: ${trackingCode}`);
        return;
      }
      
      trackingRecord = result.rows[0];
    } else {
      console.log('Finding most recent tracking record...');
      const result = await pool.query(`
        SELECT t.*, p.po_number 
        FROM po_email_tracking t
        JOIN purchase_orders p ON t.po_id = p.po_id
        WHERE t.status = 'pending'
        ORDER BY t.sent_date DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        console.error('No pending tracking records found');
        return;
      }
      
      trackingRecord = result.rows[0];
    }
    
    console.log(`\nSelected PO #${trackingRecord.po_number} (ID: ${trackingRecord.po_id}) with tracking code: ${trackingRecord.tracking_code}`);
    console.log(`Current status: ${trackingRecord.status}, Recipient: ${trackingRecord.recipient_email}`);
    
    // Manual update in the database
    console.log('\nPerforming direct database updates...');
    
    // 1. Update tracking record status
    await pool.query(`
      UPDATE po_email_tracking 
      SET status = 'approved', 
          approval_date = NOW(), 
          approval_email = $1,
          notes = 'Manually approved via script'
      WHERE tracking_code = $2
    `, [trackingRecord.recipient_email, trackingRecord.tracking_code]);
    console.log('Tracking record updated to approved status');
    
    // 2. Update purchase order status
    await pool.query(`
      UPDATE purchase_orders
      SET status = 'approved', 
          approval_status = 'approved',
          approval_date = NOW(), 
          approved_by = $1,
          notes = COALESCE(notes, '') || ' Manually approved via script'
      WHERE po_id = $2
    `, [trackingRecord.recipient_email, trackingRecord.po_id]);
    console.log('Purchase order updated to approved status');
    
    // Remove rerouting functionality
    /*
    // 3. Process re-routing
    console.log(`\nInitiating re-routing to ${process.env.REROUTE_EMAIL}...`);
    try {
      const rerouteResult = await emailService.reRouteApprovedPO(
        trackingRecord.po_id,
        process.env.REROUTE_EMAIL,
        trackingRecord.tracking_code
      );
      console.log('Re-routing successful:', rerouteResult);
    } catch (rerouteError) {
      console.error('Error during re-routing:', rerouteError);
      
      // Attempt fallback email
      try {
        console.log('Sending fallback notification email...');
        const mailOptions = {
          from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
          to: process.env.REROUTE_EMAIL,
          subject: `Purchase Order #${trackingRecord.po_number} Approved (Manual)`,
          html: `
            <h2>Purchase Order #${trackingRecord.po_number}</h2>
            <p>This purchase order has been manually approved.</p>
            <p>This is a fallback notification because automatic re-routing failed.</p>
          `
        };
        
        const info = await emailService.transporter.sendMail(mailOptions);
        console.log('Fallback email sent successfully:', info.messageId);
      } catch (emailError) {
        console.error('Failed to send fallback email:', emailError);
      }
    }
    */
    
    await pool.end();
    console.log('\nManual approval process completed.');
  } catch (error) {
    console.error('Error during manual approval:', error);
  }
}

manuallyApproveOrder().catch(console.error); 