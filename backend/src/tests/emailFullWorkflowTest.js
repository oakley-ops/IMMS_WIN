require('dotenv').config();
const emailTrackingService = require('../services/emailTrackingService');
const emailService = require('../services/emailService');

// Set up email service
emailTrackingService.setEmailService(emailService);

// Test data
const TEST_PO_ID = 1; // Use a real PO ID from your database
const TEST_TRACKING_CODE = 'test-e2e-' + Date.now(); // Generate unique tracking code
const TEST_RECIPIENT = 'test-recipient@example.com';
const TEST_APPROVER = 'test-approver@example.com';

// Configure re-routing
process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
process.env.PO_APPROVAL_REROUTE_EMAIL = TEST_RECIPIENT;
process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX = '[TEST E2E]';

async function runE2ETest() {
  console.log('Starting End-to-End PO Approval & Re-routing Test');
  console.log('=================================================');
  
  try {
    // 1. Simulate receiving an approval email
    console.log('1. Simulating receipt of approval email...');
    
    // First, ensure we have a test tracking record
    const trackingRecord = await createTestTrackingRecord();
    console.log(`Created test tracking record with code: ${trackingRecord.tracking_code}`);
    
    // 2. Process the "email" as approved
    console.log('2. Processing approval email...');
    const processResult = await emailTrackingService.processEmailApproval(
      trackingRecord.tracking_code,
      TEST_APPROVER,
      true, // isApproved
      'Approved for testing.'
    );
    
    console.log('Process result:', processResult);
    
    // 3. Verify the PO status changed to approved
    console.log('3. Verifying PO status update...');
    const updatedPo = await getPOStatus(TEST_PO_ID);
    
    console.log('Updated PO:', {
      id: updatedPo.po_id,
      status: updatedPo.status,
      approval_status: updatedPo.approval_status
    });
    
    // 4. Check for re-routing record in the database
    console.log('4. Checking for re-routing record...');
    const rerouteResult = await checkRerouteRecord(trackingRecord.tracking_code);
    
    if (rerouteResult) {
      console.log('Re-routing record found:', rerouteResult);
      console.log('✅ End-to-end test SUCCESSFUL');
    } else {
      console.log('❌ Re-routing record NOT found - test FAILED');
    }
    
    console.log('=================================================');
    console.log('Test complete. Please also check the test email inbox to confirm receipt.');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Clean up
    await emailTrackingService.pool.end();
    process.exit(0);
  }
}

// Helper: Create a test tracking record
async function createTestTrackingRecord() {
  const client = await emailTrackingService.pool.connect();
  try {
    // First check if the PO exists
    const poResult = await client.query(
      'SELECT * FROM purchase_orders WHERE po_id = $1',
      [TEST_PO_ID]
    );
    
    if (poResult.rows.length === 0) {
      throw new Error(`Test PO with ID ${TEST_PO_ID} not found. Please use a valid PO ID.`);
    }
    
    // Reset the PO to pending status
    await client.query(
      `UPDATE purchase_orders 
       SET status = 'pending', 
           approval_status = 'pending',
           approval_date = NULL,
           approved_by = NULL
       WHERE po_id = $1`,
      [TEST_PO_ID]
    );
    
    // Create a test tracking record
    const result = await client.query(
      `INSERT INTO po_email_tracking 
       (po_id, recipient_email, email_subject, tracking_code, status, sent_date)
       VALUES ($1, $2, 'Test E2E PO Approval', $3, 'pending', NOW())
       RETURNING *`,
      [TEST_PO_ID, TEST_APPROVER, TEST_TRACKING_CODE]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Helper: Get updated PO status
async function getPOStatus(poId) {
  const client = await emailTrackingService.pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM purchase_orders WHERE po_id = $1',
      [poId]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Helper: Check for re-routing record
async function checkRerouteRecord(trackingCode) {
  const client = await emailTrackingService.pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM email_rerouting_log 
       WHERE original_tracking_code = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [trackingCode]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Run the E2E test
runE2ETest();



