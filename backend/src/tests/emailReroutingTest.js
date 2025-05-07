// Test script for PO approval re-routing functionality
require('dotenv').config();
const emailTrackingService = require('../services/emailTrackingService');
const emailService = require('../services/emailService');

// Make sure tracking service has access to email service
emailTrackingService.setEmailService(emailService);

// Override environment variables for testing
process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
process.env.PO_APPROVAL_REROUTE_EMAIL = 'ikerodz@gmail.com'; // Use your test email address
process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX = '[TEST APPROVED PO]';

// Mock PO ID and tracking code (these should exist in your development database)
const TEST_PO_ID = 211; // Using the PO that exists in your database (PO ID 211 from screenshot)
const TEST_TRACKING_CODE = 'test-tracking-code-' + Date.now(); // Generate a unique tracking code
const TEST_APPROVAL_EMAIL = 'test-approver@example.com';

async function runTest() {
  console.log('Starting PO Re-routing Test');
  console.log('=========================');
  console.log('Test Configuration:');
  console.log(`- PO ID: ${TEST_PO_ID}`);
  console.log(`- Tracking Code: ${TEST_TRACKING_CODE}`);
  console.log(`- Approval Email: ${TEST_APPROVAL_EMAIL}`);
  console.log(`- Re-route Recipient: ${process.env.PO_APPROVAL_REROUTE_EMAIL}`);
  console.log('=========================');
  
  try {
    // Test 1: Verify database connection
    console.log('Test 1: Verifying database connection...');
    await emailTrackingService.pool.query('SELECT NOW()');
    console.log('Database connection successful ✓');
    
    // Test 2: Verify email service is available
    console.log('Test 2: Verifying email service availability...');
    if (!emailTrackingService.emailService) {
      throw new Error('Email service not available');
    }
    console.log('Email service available ✓');
    
    // Skip tracking record creation - just use existing PO
    console.log('Using existing PO for testing...');
    
    // Test 3: Execute re-routing function
    console.log('Test 3: Executing re-routing function...');
    await emailTrackingService.rerouteApprovedPO(
      TEST_PO_ID,
      TEST_TRACKING_CODE,
      TEST_APPROVAL_EMAIL
    );
    console.log('Re-routing function executed without errors ✓');
    
    // Test 4: Verify email was logged in database
    console.log('Test 4: Verifying email log in database...');
    const result = await emailTrackingService.pool.query(
      `SELECT * FROM email_rerouting_log 
       WHERE po_id = $1 
       AND original_tracking_code = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [TEST_PO_ID, TEST_TRACKING_CODE]
    );
    
    if (result.rows.length === 0) {
      throw new Error('No log entry found for re-routed email');
    }
    
    console.log('Email log found in database ✓');
    console.log('Log entry:', result.rows[0]);
    
    console.log('=========================');
    console.log('All tests completed successfully ✓');
    console.log('NOTE: Please check your test email inbox to confirm the email was received');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await emailTrackingService.pool.end();
    process.exit(0);
  }
}

// Run the test
runTest();
