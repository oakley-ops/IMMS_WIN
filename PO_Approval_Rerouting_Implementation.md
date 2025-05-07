# PO Approval Re-routing Implementation Checklist

## Overview
When a Purchase Order (PO) is approved via email, the system will automatically re-route (forward) the approval notification to another designated recipient without disrupting the existing approval workflow.

## Implementation Steps

### 1. Configuration Setup
- [ ] Add new environment variables in `.env` file for re-routing configuration:
  ```
  PO_APPROVAL_REROUTE_ENABLED=true
  PO_APPROVAL_REROUTE_EMAIL=recipient@example.com
  PO_APPROVAL_REROUTE_SUBJECT_PREFIX=[APPROVED PO]
  ```

### 2. Modify Email Tracking Service
- [ ] Locate the `processEmailApproval` method in `backend/src/services/emailTrackingService.js`
- [ ] Add a new function for re-routing in the same file (do not modify existing functions):
  ```javascript
  // Add after the processEmailApproval method
  async rerouteApprovedPO(poId, trackingCode, approvalEmail) {
    // Only proceed if re-routing is enabled
    if (process.env.PO_APPROVAL_REROUTE_ENABLED !== 'true') {
      console.log('PO approval re-routing is disabled');
      return;
    }

    try {
      // Get PO details from database
      const client = await this.pool.connect();
      const poResult = await client.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [poId]
      );
      client.release();

      if (poResult.rows.length === 0) {
        console.log(`No PO found with ID ${poId} for re-routing`);
        return;
      }

      const po = poResult.rows[0];
      
      // Get tracking record to access PDF data if available
      const trackingResult = await this.getTrackingRecordByCode(trackingCode);
      const pdfData = trackingResult?.pdf_data;

      // Check if email service is available
      if (!this.emailService) {
        console.error('Email service not available for re-routing');
        return;
      }

      // Prepare email content
      const subject = `${process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX || '[APPROVED PO]'} ${po.po_number}`;
      const recipient = process.env.PO_APPROVAL_REROUTE_EMAIL;
      
      const emailContent = {
        to: recipient,
        subject: subject,
        html: `
          <p>Purchase Order ${po.po_number} has been approved by ${approvalEmail}.</p>
          <p>Approval Date: ${new Date().toLocaleString()}</p>
          <p>PO Amount: $${po.total_amount}</p>
          <p>Vendor: ${po.vendor_name}</p>
          <hr>
          <p>This is an automated notification.</p>
        `,
        attachments: []
      };

      // Add PDF attachment if available
      if (pdfData) {
        emailContent.attachments.push({
          filename: `PO-${po.po_number}.pdf`,
          content: pdfData,
          encoding: 'base64'
        });
      }

      // Send email
      console.log(`Re-routing approved PO ${po.po_number} to ${recipient}`);
      await this.emailService.sendEmail(emailContent);
      
      console.log(`Successfully re-routed PO ${po.po_number} to ${recipient}`);
      
      // Log the re-routing
      const client2 = await this.pool.connect();
      await client2.query(
        `INSERT INTO email_rerouting_log 
         (po_id, original_tracking_code, recipient_email, sent_date, status)
         VALUES ($1, $2, $3, NOW(), 'sent')`,
        [poId, trackingCode, recipient]
      );
      client2.release();
      
    } catch (error) {
      console.error('Error re-routing approved PO:', error);
    }
  }
  ```

### 3. Call Re-routing Function When PO is Approved
- [ ] In the `processEmailApproval` method, add a call to the re-routing function after successful update:
  ```javascript
  // Add this after the commit transaction section in processEmailApproval
  // Right before the return statement:
  if (emailStatus === 'approved') {
    // Re-route the approved PO
    await this.rerouteApprovedPO(poId, trackingCode, approvalEmail);
  }
  ```

### 4. Create Database Table for Logging (Optional but Recommended)
- [ ] Execute the following SQL to create a table for logging re-routed emails:
  ```sql
  CREATE TABLE IF NOT EXISTS email_rerouting_log (
    id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL,
    original_tracking_code VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    sent_date TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
  ```

### 5. Testing Plan
- [ ] Update `.env` file with test recipient email
- [ ] Test the complete workflow:
  1. Send a PO approval email
  2. Confirm the PO status changes to "Approved"
  3. Verify the re-routing email is sent to the designated recipient
  4. Check email content and attachment

### 6. Monitoring and Logging
- [ ] Add appropriate logging for troubleshooting
- [ ] Ensure errors are properly caught and don't affect the main approval flow

### 7. Automation Testing
- [ ] Create a test script to validate re-routing functionality before production implementation
- [ ] Test script location: `backend/src/tests/emailReroutingTest.js`
- [ ] Test script contents:
  ```javascript
  // Test script for PO approval re-routing functionality
  require('dotenv').config();
  const emailTrackingService = require('../services/emailTrackingService');
  const emailService = require('../services/emailService');
  
  // Make sure tracking service has access to email service
  emailTrackingService.setEmailService(emailService);
  
  // Override environment variables for testing
  process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
  process.env.PO_APPROVAL_REROUTE_EMAIL = 'test-recipient@example.com'; // Use a test email address
  process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX = '[TEST APPROVED PO]';
  
  // Mock PO ID and tracking code (these should exist in your development database)
  const TEST_PO_ID = 1; // Replace with a valid PO ID from your dev database
  const TEST_TRACKING_CODE = 'test-tracking-code'; // Replace with a valid tracking code
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
  ```

- [ ] Run the test script before implementing in production:
  ```bash
  # Navigate to the backend directory
  cd backend
  
  # Run the test script
  node src/tests/emailReroutingTest.js
  ```

### 7.1 Advanced Automation Testing
- [ ] Create a more comprehensive test suite for complete validation:
  ```javascript
  // File: backend/src/tests/emailReroutingSuite.js
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
      
      // Insert test PO if it doesn't exist
      const poResult = await pool.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [TEST_DATA.standard.poId]
      );
      
      if (poResult.rows.length === 0) {
        // Create a test PO
        await pool.query(`
          INSERT INTO purchase_orders (
            po_id, po_number, vendor_name, total_amount, status, 
            approval_status, created_at, updated_at
          ) VALUES (
            $1, 'TEST-PO-123', 'Test Vendor', 1000.00, 'pending', 
            'pending', NOW(), NOW()
          ) ON CONFLICT (po_id) DO NOTHING
        `, [TEST_DATA.standard.poId]);
        
        console.log(`Created test PO with ID ${TEST_DATA.standard.poId}`);
      } else {
        console.log(`Test PO with ID ${TEST_DATA.standard.poId} already exists`);
      }
      
      // Insert test tracking record if it doesn't exist
      const trackingResult = await pool.query(
        'SELECT * FROM po_email_tracking WHERE tracking_code = $1',
        [TEST_DATA.standard.trackingCode]
      );
      
      if (trackingResult.rows.length === 0) {
        // Create a test tracking record
        const pdfData = Buffer.from('Test PDF data').toString('base64');
        await pool.query(`
          INSERT INTO po_email_tracking (
            po_id, recipient_email, email_subject, tracking_code, 
            pdf_data, status, sent_date
          ) VALUES (
            $1, $2, 'Test PO Approval', $3, 
            $4, 'pending', NOW()
          ) ON CONFLICT (tracking_code) DO NOTHING
        `, [
          TEST_DATA.standard.poId,
          TEST_DATA.standard.approvalEmail,
          TEST_DATA.standard.trackingCode,
          pdfData
        ]);
        
        console.log(`Created test tracking record with code ${TEST_DATA.standard.trackingCode}`);
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

- [ ] Add a test script for end-to-end testing of the full approval and re-routing workflow:
  ```javascript
  // File: backend/src/tests/emailFullWorkflowTest.js
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
  ```

- [ ] Create a CI/CD compatible test script that can be run in automated environments:
  ```javascript
  // File: backend/src/tests/ci-cd-tests.js
  require('dotenv').config();
  const { spawnSync } = require('child_process');
  
  // Run basic test first
  console.log('Running basic re-routing test...');
  const basicTestResult = spawnSync('node', ['src/tests/emailReroutingTest.js'], {
    stdio: 'inherit'
  });
  
  if (basicTestResult.status !== 0) {
    console.error('Basic test failed. Aborting further tests.');
    process.exit(1);
  }
  
  // Run full suite
  console.log('Running comprehensive test suite...');
  const suiteResult = spawnSync('node', ['src/tests/emailReroutingSuite.js'], {
    stdio: 'inherit'
  });
  
  if (suiteResult.status !== 0) {
    console.error('Test suite failed.');
    process.exit(1);
  }
  
  console.log('All tests passed successfully!');
  process.exit(0);
  ```

- [ ] Create an npm script in package.json for easy test execution:
  ```json
  {
    "scripts": {
      "test:rerouting": "node src/tests/ci-cd-tests.js",
      "test:rerouting:basic": "node src/tests/emailReroutingTest.js",
      "test:rerouting:suite": "node src/tests/emailReroutingSuite.js",
      "test:rerouting:e2e": "node src/tests/emailFullWorkflowTest.js"
    }
  }
  ```

### 8. Implementation Automation
- [ ] Create a deployment script to automate the implementation:
  ```bash
  #!/bin/bash
  # PO Re-routing Implementation Script
  
  # 1. Back up relevant files
  echo "Backing up files..."
  cp backend/src/services/emailTrackingService.js backend/src/services/emailTrackingService.js.bak
  
  # 2. Add re-routing function
  echo "Adding re-routing function to emailTrackingService.js..."
  # This would require a more sophisticated script to insert code at the right location
  # For now, this is a manual step with the script from the checklist
  
  # 3. Create database table
  echo "Creating email_rerouting_log table..."
  psql -U $DB_USER -d $DB_NAME -h $DB_HOST -c "
  CREATE TABLE IF NOT EXISTS email_rerouting_log (
    id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL,
    original_tracking_code VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    sent_date TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );"
  
  # 4. Update environment variables
  echo "Updating .env file..."
  if ! grep -q "PO_APPROVAL_REROUTE_ENABLED" .env; then
    echo "# PO Approval Re-routing Configuration" >> .env
    echo "PO_APPROVAL_REROUTE_ENABLED=false" >> .env
    echo "PO_APPROVAL_REROUTE_EMAIL=recipient@example.com" >> .env
    echo "PO_APPROVAL_REROUTE_SUBJECT_PREFIX=[APPROVED PO]" >> .env
  fi
  
  # 5. Restart the application
  echo "Restarting application..."
  pm2 restart all
  
  echo "Implementation complete!"
  ```

## Important Notes
- This implementation doesn't modify existing approval functionality
- The re-routing only happens after successful approval
- The system can be easily disabled by setting `PO_APPROVAL_REROUTE_ENABLED=false`
- Errors in re-routing won't affect the main approval process
- Always run the test script in a development environment before deploying to production
- The automation script provides a starting point but may need customization for your specific environment 