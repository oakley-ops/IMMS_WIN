// Test script for PO approval re-routing with PDF functionality
require('dotenv').config();
const emailTrackingService = require('../services/emailTrackingService');
const emailService = require('../services/emailService');
const { Pool } = require('pg');

// Make sure tracking service has access to email service
emailTrackingService.setEmailService(emailService);

// Initialize database connection for querying tracking records
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Override environment variables for testing
process.env.PO_APPROVAL_REROUTE_ENABLED = 'true';
process.env.PO_APPROVAL_REROUTE_EMAIL = process.env.REROUTE_EMAIL || 'ikerodz@gmail.com';
process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX = '[TEST PDF APPROVED PO]';

// Test approver email
const TEST_APPROVAL_EMAIL = 'test-approver@example.com';

async function runTest() {
  console.log('Starting PO Re-routing with PDF Test');
  console.log('=========================');
  
  try {
    // Test 1: Find a real tracking record with PDF data
    console.log('Test 1: Looking for a tracking record with PDF data...');
    
    // Query for tracking records that have PDF data
    const result = await pool.query(`
      SELECT * FROM po_email_tracking 
      WHERE pdf_data IS NOT NULL 
      ORDER BY sent_date DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('No tracking records with PDF data found.');
      console.log('Creating a test record with dummy PDF data...');
      
      // Create a test tracking record with dummy PDF data if none exists
      const pdfData = Buffer.from('%PDF-1.5\nTest PDF Content').toString('base64');
      
      // First find a valid PO to use
      const poResult = await pool.query('SELECT po_id, po_number FROM purchase_orders LIMIT 1');
      if (poResult.rows.length === 0) {
        throw new Error('No purchase orders found in the database');
      }
      
      const po = poResult.rows[0];
      
      // Create tracking record
      const trackingCode = 'test-pdf-' + Date.now();
      const insertResult = await pool.query(`
        INSERT INTO po_email_tracking 
        (po_id, recipient_email, email_subject, tracking_code, pdf_data, status, sent_date)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [
        po.po_id,
        TEST_APPROVAL_EMAIL,
        `Test PO ${po.po_number} Approval`,
        trackingCode,
        pdfData,
        'approved'
      ]);
      
      const trackingRecord = insertResult.rows[0];
      console.log('Created test tracking record with PDF data:', trackingRecord.tracking_code);
      
      // Test 2: Re-route the PO with PDF
      console.log('Test 2: Re-routing PO with PDF...');
      await emailTrackingService.rerouteApprovedPO(
        trackingRecord.po_id,
        trackingRecord.tracking_code,
        TEST_APPROVAL_EMAIL
      );
      
      console.log('Test completed. Check your email inbox for the PDF attachment.');
    } else {
      // Use an existing record with PDF data
      const trackingRecord = result.rows[0];
      console.log('Found tracking record with PDF data:', trackingRecord.tracking_code);
      
      // Test 2: Re-route the PO with PDF
      console.log('Test 2: Re-routing PO with PDF...');
      await emailTrackingService.rerouteApprovedPO(
        trackingRecord.po_id,
        trackingRecord.tracking_code,
        TEST_APPROVAL_EMAIL
      );
      
      console.log('Test completed. Check your email inbox for the PDF attachment.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await pool.end();
    await emailTrackingService.pool.end();
    process.exit(0);
  }
}

// Run the test
runTest(); 