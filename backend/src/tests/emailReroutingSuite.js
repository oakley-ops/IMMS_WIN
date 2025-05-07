require('dotenv').config();
const emailTrackingService = require('../services/emailTrackingService');
const emailService = require('../services/emailService');
const { Pool } = require('pg');

// Make sure tracking service has access to email service
emailTrackingService.setEmailService(emailService);

// Mock data
const TEST_DATA = {
  standard: {
    poId: 1,
    trackingCode: 'test-tracking-code-1',
    approvalEmail: 'test-approver@example.com',
    recipient: 'standard-recipient@example.com'
  },
  multiple: {
    poId: 2,
    trackingCode: 'test-tracking-code-2',
    approvalEmail: 'test-approver@example.com',
    recipients: ['recipient1@example.com', 'recipient2@example.com']
  },
  error: {
    poId: 999, // Non-existent PO ID to trigger error handling
    trackingCode: 'test-tracking-code-error',
    approvalEmail: 'test-approver@example.com'
  }
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
function logSuccess(message) {
  console.log(`✅ ${message}`);
  testResults.passed++;
}

function logFailure(message, error = null) {
  console.error(`❌ ${message}`);
  testResults.failed++;
  if (error) {
    testResults.errors.push({message, error: error.toString()});
    console.error(`   Error: ${error}`);
  } else {
    testResults.errors.push({message});
  }
}

// Setup test database - creates temporary test records
async function setupTestData() {
  console.log('Setting up test data...');
  
  // Create a dedicated pool for setup
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // First ensure the email_rerouting_log table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_rerouting_log (
        id SERIAL PRIMARY KEY,
        po_id INTEGER NOT NULL,
        original_tracking_code VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        sent_date TIMESTAMP NOT NULL DEFAULT NOW(),
        status VARCHAR(50) NOT NULL DEFAULT 'sent',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Use the existing PO with ID 211
    TEST_DATA.standard.poId = 211;
    
    // Insert test tracking record if it doesn't exist
    const trackingResult = await pool.query(
      'SELECT * FROM po_email_tracking WHERE tracking_code = $1',
      [TEST_DATA.standard.trackingCode]
    );
    
    if (trackingResult.rows.length === 0) {
      // Create a test tracking record
      const pdfData = Buffer.from('Test PDF data').toString('base64');
      try {
        await pool.query(`
          INSERT INTO po_email_tracking (
            po_id, recipient_email, email_subject, tracking_code, 
            status, sent_date
          ) VALUES (
            $1, $2, 'Test PO Approval', $3, 
            'approved', NOW()
          ) ON CONFLICT (tracking_code) DO NOTHING
        `, [
          TEST_DATA.standard.poId,
          TEST_DATA.standard.approvalEmail,
          TEST_DATA.standard.trackingCode
        ]);
        
        console.log(`Created test tracking record with code ${TEST_DATA.standard.trackingCode}`);
      } catch (error) {
        console.log('Error creating tracking record:', error.message);
        // Check if the error is because pdf_data column doesn't exist
        if (error.message.includes('pdf_data')) {
          console.log('Trying again without pdf_data column');
          await pool.query(`
            INSERT INTO po_email_tracking (
              po_id, recipient_email, email_subject, tracking_code, 
              status, sent_date
            ) VALUES (
              $1, $2, 'Test PO Approval', $3, 
              'approved', NOW()
            ) ON CONFLICT (tracking_code) DO NOTHING
          `, [
            TEST_DATA.standard.poId,
            TEST_DATA.standard.approvalEmail,
            TEST_DATA.standard.trackingCode
          ]);
          console.log(`Created test tracking record with code ${TEST_DATA.standard.trackingCode}`);
        } else {
          throw error;
        }
      }
    } else {
      console.log(`Test tracking record with code ${TEST_DATA.standard.trackingCode} already exists`);
    }
    
    console.log('Test data setup complete');
    return true;
  } catch (error) {
    console.error('Error setting up test data:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Test suite
async function runTestSuite() {
  console.log('=========================');
  console.log('PO Re-routing Test Suite');
  console.log('=========================');
  
  // Override environment variables for testing
  process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
  process.env.PO_APPROVAL_REROUTE_EMAIL = TEST_DATA.standard.recipient;
  process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX = '[TEST APPROVED PO]';
  
  try {
    // Setup phase
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      logFailure('Test data setup failed');
      return;
    }
    logSuccess('Test data setup');
    
    // Test 1: Basic re-routing functionality
    console.log('\nTest 1: Basic re-routing functionality');
    try {
      await emailTrackingService.rerouteApprovedPO(
        TEST_DATA.standard.poId,
        TEST_DATA.standard.trackingCode,
        TEST_DATA.standard.approvalEmail
      );
      
      // Verify email log in database
      const result = await emailTrackingService.pool.query(
        `SELECT * FROM email_rerouting_log 
         WHERE po_id = $1 
         AND original_tracking_code = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [TEST_DATA.standard.poId, TEST_DATA.standard.trackingCode]
      );
      
      if (result.rows.length === 0) {
        logFailure('No log entry found for re-routed email');
      } else {
        logSuccess('Basic re-routing functionality passed');
      }
    } catch (error) {
      logFailure('Basic re-routing functionality failed', error);
    }
    
    // Test 2: Error handling for non-existent PO
    console.log('\nTest 2: Error handling for non-existent PO');
    try {
      await emailTrackingService.rerouteApprovedPO(
        TEST_DATA.error.poId,
        TEST_DATA.error.trackingCode,
        TEST_DATA.error.approvalEmail
      );
      
      // If we got here, the error was handled properly (didn't throw)
      logSuccess('Error handling for non-existent PO passed');
    } catch (error) {
      logFailure('Error handling for non-existent PO failed', error);
    }
    
    // Test 3: Disabled re-routing
    console.log('\nTest 3: Disabled re-routing');
    try {
      // Disable re-routing
      process.env.PO_APPROVAL_REROUTE_ENABLED = 'false';
      
      // Clear existing logs for this test
      await emailTrackingService.pool.query(
        `DELETE FROM email_rerouting_log 
         WHERE po_id = $1 
         AND original_tracking_code = $2`,
        [TEST_DATA.standard.poId, TEST_DATA.standard.trackingCode]
      );
      
      // Attempt re-routing
      await emailTrackingService.rerouteApprovedPO(
        TEST_DATA.standard.poId,
        TEST_DATA.standard.trackingCode,
        TEST_DATA.standard.approvalEmail
      );
      
      // Verify no email log in database
      const result = await emailTrackingService.pool.query(
        `SELECT * FROM email_rerouting_log 
         WHERE po_id = $1 
         AND original_tracking_code = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [TEST_DATA.standard.poId, TEST_DATA.standard.trackingCode]
      );
      
      if (result.rows.length === 0) {
        logSuccess('Disabled re-routing functionality passed');
      } else {
        logFailure('Disabled re-routing sent an email when it should not have');
      }
    } catch (error) {
      logFailure('Disabled re-routing test failed', error);
    }
    
  } catch (error) {
    console.error('Unexpected error in test suite:', error);
  } finally {
    // Re-enable for further tests
    process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
    
    // Print test results
    console.log('\n=========================');
    console.log('Test Suite Results');
    console.log('=========================');
    console.log(`Total tests: ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    
    if (testResults.errors.length > 0) {
      console.log('\nErrors:');
      testResults.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.message}`);
        if (err.error) console.log(`   ${err.error}`);
      });
    }
    
    // Clean up
    console.log('\nClosing database connections...');
    await emailTrackingService.pool.end();
    console.log('Test suite complete');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// Run the test suite
runTestSuite();



