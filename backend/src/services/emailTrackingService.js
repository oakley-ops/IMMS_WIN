// Ensure environment variables are loaded
require('dotenv').config();

const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { generatePurchaseOrderPDF } = require('../utils/pdfGenerator');

// Socket.IO will be injected later
let socketIo = null;

class EmailTrackingService {
  constructor() {
    // Log environment variables to verify they're loaded
    console.log('Email Tracking Service - Environment variables loaded:', {
      DB_USER: process.env.DB_USER,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_SSL: process.env.DB_SSL
    });

    // List of authorized approvers
    this.authorizedApprovers = [
      'isaac.rodriguez@fiserv.com',  // Isaac's email (to be changed later)
    ].filter(Boolean); // Remove any undefined/null values

    // Use individual parameters for better control and debugging
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Test the connection
    this.pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('Error connecting to database:', err);
      } else {
        console.log('Database connection pool initialized successfully:', res.rows[0]);
      }
    });

    // Initialize email service
    this.emailService = null;
    
    // Look for Socket.IO global instances
    this.setupSocketIo();

    // Initialize necessary database tables
    this.initializeRequiredTables();
  }
  
  // Setup Socket.IO connection
  setupSocketIo() {
    // Check for global.io or global.socket
    if (global.io) {
      socketIo = global.io;
      console.log('Using global.io for Socket.IO communication');
    } else if (global.socket) {
      socketIo = global.socket;
      console.log('Using global.socket for Socket.IO communication');
    } else if (process.env.SOCKET_URL) {
      try {
        console.log('Attempting to connect to Socket.IO server at', process.env.SOCKET_URL);
        const { io } = require('socket.io-client');
        socketIo = io(process.env.SOCKET_URL);
        socketIo.on('connect', () => {
          console.log('Email tracking service connected to Socket.IO server');
        });
        socketIo.on('connect_error', (error) => {
          console.error('Socket.IO connection error:', error);
        });
        socketIo.on('disconnect', (reason) => {
          console.log('Socket.IO disconnected:', reason);
        });
      } catch (error) {
        console.error('Failed to initialize Socket.IO client:', error);
      }
    } else {
      console.warn('No Socket.IO configuration found');
    }
  }
  
  // Allow direct setting of socketIo
  set socketIo(socket) {
    socketIo = socket;
    console.log('Socket.IO instance directly set in EmailTrackingService');
  }

  setEmailService(service) {
    console.log('Setting email service via setEmailService method...');
    this.emailService = service;
    console.log('Email service set successfully');
  }

  // Generate a unique tracking code
  generateTrackingCode() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Create a new email tracking record
  async createTrackingRecord(poId, recipientEmail, subject, pdfData = null, notes = null) {
    console.log('Creating tracking record in database...');
    console.log('PO ID:', poId);
    console.log('Recipient:', recipientEmail);
    console.log('Subject:', subject);
    console.log('Notes provided:', !!notes);
    
    const client = await this.pool.connect();
    try {
      const trackingCode = this.generateTrackingCode();
      console.log('Generated tracking code:', trackingCode);
      
      const result = await client.query(
        `INSERT INTO po_email_tracking 
         (po_id, recipient_email, email_subject, tracking_code, pdf_data, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [poId, recipientEmail, subject, trackingCode, pdfData, notes]
      );
      
      console.log('Tracking record created successfully:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating tracking record:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get tracking record by tracking code
  async getTrackingRecordByCode(trackingCode) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM po_email_tracking WHERE tracking_code = $1',
        [trackingCode]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Update tracking record status
  async updateTrackingStatus(trackingCode, status, approvalEmail = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE po_email_tracking 
         SET status = $1, 
             approval_date = CURRENT_TIMESTAMP,
             approval_email = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE tracking_code = $3
         RETURNING *`,
        [status, approvalEmail, trackingCode]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Update PO approval status
  async updatePOApprovalStatus(poId, status, approvalEmail) {
    const client = await this.pool.connect();
    try {
      // If rejecting, set status to 'canceled' (allowed by the constraint)
      // Otherwise use the provided status
      const poStatus = status === 'rejected' ? 'canceled' : status;
      
      const result = await client.query(
        `UPDATE purchase_orders 
         SET status = $1,
             approval_status = $2,
             approval_date = CURRENT_TIMESTAMP,
             approval_email = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE po_id = $4
         RETURNING *`,
        [poStatus, status, approvalEmail, poId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get all tracking records for a PO
  async getPOEmailHistory(poId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM po_email_tracking 
         WHERE po_id = $1 
         ORDER BY sent_date DESC`,
        [poId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Check the status of an email by tracking code
  async getEmailStatus(trackingCode) {
    // ... existing code ...
  }

  // Helper method to safely emit Socket.IO events
  emitSocketEvent(eventName, data) {
    // Re-check for socket availability
    if (!socketIo) {
      this.setupSocketIo();
    }
    
    if (socketIo) {
      try {
        socketIo.emit(eventName, data);
        console.log(`Emitted ${eventName} event:`, data);
        return true;
      } catch (error) {
        console.error(`Error emitting ${eventName} event:`, error);
        return false;
      }
    } else {
      console.warn('Socket.IO instance not available - could not emit event:', eventName);
      return false;
    }
  }

  // Process email approval
  async processEmailApproval(trackingCode, approvalEmail, isApproved, notes = '') {
    console.log('Starting email approval process...');
    console.log('Tracking code:', trackingCode);
    console.log('Approval email:', approvalEmail);
    console.log('Is approved:', isApproved);
    console.log('Notes:', notes);
    
    let client;
    
    try {
      console.log('Getting database connection...');
      client = await this.pool.connect();
      console.log('Database connection established');
      
      // Begin a transaction
      console.log('Beginning transaction...');
      await client.query('BEGIN');
      console.log('Transaction started');
      
      // Fetch the tracking record
      console.log('Fetching tracking record...');
      const trackingResult = await client.query(
        'SELECT * FROM po_email_tracking WHERE tracking_code = $1',
        [trackingCode]
      );
      
      if (trackingResult.rows.length === 0) {
        console.log('No tracking record found for code:', trackingCode);
        throw new Error('Invalid tracking code');
      }
      
      const trackingRecord = trackingResult.rows[0];
      
      // Check if the approver is authorized
      const isAuthorizedApprover = this.authorizedApprovers.some(
        email => email.toLowerCase() === approvalEmail.toLowerCase()
      );
      
      // Check if this is a rerouted email (doesn't need approval)
      const isReroutedEmail = trackingRecord.rerouted_tracking_code !== null;
      
      if (!isAuthorizedApprover && !isReroutedEmail) {
        console.log('Approval email not authorized!');
        console.log('Expected one of:', this.authorizedApprovers);
        console.log('Received:', approvalEmail.toLowerCase());
        throw new Error('Unauthorized approval attempt');
      }
      
      // Determine the status for email tracking record
      let emailStatus = 'pending';
      
      // Get the first line of the email for initial status check
      const firstLine = notes.split('\n')[0]?.trim().toLowerCase() || '';
      console.log('First line of email:', firstLine);
      
      // Define approval and hold keywords
      const approvalKeywords = ['approved', 'approval', 'accept', 'accepted', 'yes', 'confirm', 'confirmed', 
                               'looks good', 'i approve', 'approve', 'ok', 'good', 'fine', 'agreed', 'correct'];
      const holdKeywords = ['on hold', 'need changes', 'changes needed', 'need more info', 
                           'more information', 'revise', 'revision needed', 'update needed', 'clarify',
                           'clarification needed', 'modify', 'modification needed', 'incomplete',
                           'not ready', 'wait', 'pending changes', 'fix', 'needs fixing', 'issue', 
                           'problem', 'concern', 'redo', 'adjust', 'edit', 'correction'];
      
      // Check for explicit approval in first line
      const hasApprovalInFirstLine = approvalKeywords.some(keyword => firstLine.includes(keyword));
      const hasHoldInFirstLine = holdKeywords.some(keyword => firstLine.includes(keyword));
      
      console.log('Has approval in first line:', hasApprovalInFirstLine);
      console.log('Has hold in first line:', hasHoldInFirstLine);
      
      // Check for keywords in the full notes
      const hasApprovalInNotes = approvalKeywords.some(keyword => notes.toLowerCase().includes(keyword));
      const hasHoldInNotes = holdKeywords.some(keyword => notes.toLowerCase().includes(keyword));
      
      console.log('Has approval in notes:', hasApprovalInNotes);
      console.log('Has hold in notes:', hasHoldInNotes);
      
      // Decision logic - Prioritize explicit approval in first line
      if (hasApprovalInFirstLine) {
        console.log('Approval detected in first line - Setting to approved');
        emailStatus = 'approved';
      } else if (hasHoldInFirstLine) {
        console.log('Hold detected in first line - Setting to on_hold');
        emailStatus = 'on_hold';
      } else if (hasApprovalInNotes) {
        console.log('Approval detected in notes - Setting to approved');
        emailStatus = 'approved';
      } else if (hasHoldInNotes) {
        console.log('Hold detected in notes - Setting to on_hold');
        emailStatus = 'on_hold';
      } else if (isApproved) {
        console.log('Using isApproved flag - Setting to approved');
        emailStatus = 'approved';
      } else {
        console.log('No clear indication - Setting to rejected');
        emailStatus = 'rejected';
      }
      
      console.log('FINAL EMAIL STATUS:', emailStatus);
      
      // If this is a re-process of an already approved email, don't change status unless explicitly rejected
      if (trackingRecord.status === 'approved' && emailStatus !== 'rejected') {
        console.log('Email was already approved, maintaining approved status');
        emailStatus = 'approved';
      }
      
      // Update the tracking record
      console.log('Updating tracking record with status:', emailStatus);
      await client.query(
        `UPDATE po_email_tracking 
         SET status = $1, 
             approval_date = NOW(), 
             approval_email = $2,
             notes = $3
         WHERE tracking_code = $4`,
        [emailStatus, approvalEmail, notes, trackingCode]
      );
      
      // Get the purchase order ID
      const poId = trackingRecord.po_id;
      
      // Get current purchase order status
      const poResult = await client.query(
        'SELECT status, approval_status FROM purchase_orders WHERE po_id = $1',
        [poId]
      );
      
      if (poResult.rows.length === 0) {
        throw new Error('Purchase order not found');
      }
      
      const currentStatus = poResult.rows[0].status;
      
      // Update the purchase order status accordingly
      console.log('Updating purchase order status...');
      let poStatus = currentStatus;
      let poApprovalStatus = emailStatus;
      
      // Determine the new PO status based on approval status
      if (emailStatus === 'approved') {
        poStatus = 'approved';
        poApprovalStatus = 'approved';
        console.log('Setting PO status to approved - Current status:', currentStatus);
      } else if (emailStatus === 'on_hold') {
        poStatus = 'pending';
        poApprovalStatus = 'on_hold';
        console.log('Setting PO status to pending - Current status:', currentStatus);
      } else {
        poStatus = 'canceled';
        poApprovalStatus = 'rejected';
        console.log('Setting PO status to canceled - Current status:', currentStatus);
      }
      
      // Update both status and approval_status
      console.log(`Setting PO status to '${poStatus}' and approval_status to '${poApprovalStatus}'`);
      const updateResult = await client.query(
        `UPDATE purchase_orders 
         SET status = $1, 
             approval_status = $2,
             approval_date = NOW(), 
             approved_by = $3,
             notes = COALESCE($4, notes)
         WHERE po_id = $5
         RETURNING status, approval_status`,
        [poStatus, poApprovalStatus, approvalEmail, notes, poId]
      );
      
      console.log('PO update result:', updateResult.rows[0]);

      // Commit transaction
      console.log('Committing transaction...');
      await client.query('COMMIT');
      
      // Emit status update event
      this.emitSocketEvent('po_status_update', {
        poId: trackingRecord.po_id,
        status: isApproved ? 'approved' : 'rejected',
        approvalEmail,
        notes
      });
      
      // Also emit a broader PO update event to refresh the UI
      this.emitSocketEvent('purchase_order_update', {
        po_id: poId,
        status: poStatus,
        approval_status: poApprovalStatus
      });
      
      // Re-route the approved PO to the designated recipient
      if (emailStatus === 'approved') {
        await this.rerouteApprovedPO(poId, trackingCode, approvalEmail);
      }
      
      return {
        success: true,
        poId,
        newStatus: poStatus,
        approvalStatus: poApprovalStatus
      };
    } catch (error) {
      console.error('Error in processEmailApproval:', error);
      
      if (client) {
        // Rollback transaction on error
        console.log('Rolling back transaction...');
        await client.query('ROLLBACK');
        console.log('Transaction rolled back');
      }
      
      throw error;
    } finally {
      if (client) {
        // Release the client back to the pool
        console.log('Releasing database connection...');
        client.release();
        console.log('Database connection released');
      }
    }
  }

  // Initialize required database tables
  async initializeRequiredTables() {
    try {
      // Create the failed_email_attempts table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS failed_email_attempts (
          id SERIAL PRIMARY KEY,
          recipient VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          html_content TEXT,
          pdf_data TEXT,
          po_id INTEGER,
          po_number VARCHAR(50),
          error_message TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMP,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
        );
      `);
      console.log('Ensured failed_email_attempts table exists');
      
      // Create the email_rerouting_log table if it doesn't exist
      await this.pool.query(`
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
      console.log('Ensured email_rerouting_log table exists');
    } catch (error) {
      console.error('Error initializing database tables:', error);
    }
  }

  async storeFailedEmailAttempt(emailData) {
    try {
      // First ensure the table exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS failed_email_attempts (
          id SERIAL PRIMARY KEY,
          recipient VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          html_content TEXT,
          pdf_data TEXT,
          po_id INTEGER,
          po_number VARCHAR(50),
          error_message TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMP,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
        );
      `);
      
      const result = await this.pool.query(
        `INSERT INTO failed_email_attempts 
        (recipient, subject, html_content, pdf_data, po_id, po_number, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id`,
        [
          emailData.recipient,
          emailData.subject,
          emailData.html,
          emailData.pdfBase64,
          emailData.poId,
          emailData.poNumber,
          emailData.errorMessage
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error storing failed email attempt:', error);
      throw error;
    }
  }

  async getFailedEmailAttempts() {
    try {
      const result = await this.pool.query(
        `SELECT * FROM failed_email_attempts 
        WHERE status = 'pending' 
        ORDER BY created_at ASC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting failed email attempts:', error);
      throw error;
    }
  }

  async markEmailAttemptAsProcessed(id, success) {
    try {
      await this.pool.query(
        `UPDATE failed_email_attempts 
        SET status = $1, processed_at = NOW() 
        WHERE id = $2`,
        [success ? 'sent' : 'failed', id]
      );
    } catch (error) {
      console.error('Error marking email attempt as processed:', error);
      throw error;
    }
  }

  // Add re-routing function for approved POs
  async rerouteApprovedPO(poId, trackingCode, approvalEmail) {
    // Only proceed if re-routing is enabled
    if (process.env.PO_APPROVAL_REROUTE_ENABLED !== 'true') {
      console.log('PO approval re-routing is disabled');
      return;
    }

    try {
      // Get PO details from database
      const client = await this.pool.connect();
      
      // First check if this PO has already been rerouted to prevent loops
      const rerouteCheckResult = await client.query(
        `SELECT * FROM email_rerouting_log 
         WHERE po_id = $1 
         ORDER BY sent_date DESC 
         LIMIT 1`,
        [poId]
      );
      
      // If we find a recent rerouting record (within the last hour), skip to prevent loops
      if (rerouteCheckResult.rows.length > 0) {
        const lastReroute = rerouteCheckResult.rows[0];
        const lastRerouteTime = new Date(lastReroute.sent_date).getTime();
        const currentTime = new Date().getTime();
        const timeSinceLastReroute = (currentTime - lastRerouteTime) / 1000 / 60; // minutes
        
        if (timeSinceLastReroute < 60) { // If less than 60 minutes since last reroute
          console.log(`Skipping re-route for PO #${poId} - already rerouted ${timeSinceLastReroute.toFixed(2)} minutes ago`);
          client.release();
          return;
        }
      }
      
      const poResult = await client.query(
        'SELECT po_id, po_number, total_amount FROM purchase_orders WHERE po_id = $1',
        [poId]
      );
      client.release();

      if (poResult.rows.length === 0) {
        console.log(`No PO found with ID ${poId} for re-routing`);
        return;
      }

      const po = poResult.rows[0];
      
      // Get tracking record to access PDF data if available
      const trackingRecord = await this.getTrackingRecordByCode(trackingCode);
      const pdfData = trackingRecord?.pdf_data;
      
      // Check if email service is available
      if (!this.emailService) {
        console.error('Email service not available for re-routing');
        return;
      }

      // Prepare email content
      const subject = `${process.env.PO_APPROVAL_REROUTE_SUBJECT_PREFIX || '[APPROVED PO]'} ${po.po_number}`;
      const recipient = process.env.REROUTE_EMAIL || process.env.PO_APPROVAL_REROUTE_EMAIL;
      
      console.log(`Re-routing approved PO ${po.po_number} to ${recipient}`);
      
      // Check if recipient is ikeodz@gmail.com to add the special message
      const isIkeodzEmail = recipient.toLowerCase() === 'ikeodz@gmail.com';
      const specialMessage = isIkeodzEmail ? '<p><strong>Please create a Purchasing Order Number for the Following Items</strong></p>' : '';
      
      // Instead of creating a new tracking record with sendPurchaseOrderPDF,
      // use a simpler method that won't create tracking records
      if (pdfData) {
        // Create a simple email with PDF attachment
        const html = `
          ${specialMessage}
          <p>Purchase Order ${po.po_number} has been approved by ${approvalEmail}.</p>
          <p>Approval Date: ${new Date().toLocaleString()}</p>
          <p>PO Amount: $${po.total_amount || 'Not specified'}</p>
          <hr>
          <p>This is an automated notification with the approved PO attached.</p>
        `;
        
        // Use the simpler sendEmail method with attachment option
        const mailOptions = {
          to: recipient,
          subject,
          html,
          attachments: [{
            filename: `PO-${po.po_number}.pdf`,
            content: pdfData,
            encoding: 'base64'
          }]
        };
        
        await this.emailService.sendEmailDirect(mailOptions);
        console.log(`Successfully re-routed PO ${po.po_number} with PDF to ${recipient}`);
      } else {
        // No PDF data, use simple email instead
        const html = `
          ${specialMessage}
          <p>Purchase Order ${po.po_number} has been approved by ${approvalEmail}.</p>
          <p>Approval Date: ${new Date().toLocaleString()}</p>
          <p>PO Amount: $${po.total_amount || 'Not specified'}</p>
          <hr>
          <p>This is an automated notification.</p>
        `;

        console.log(`Re-routing approved PO ${po.po_number} to ${recipient} (without PDF)`);
        await this.emailService.sendEmail(subject, html, recipient);
        console.log(`Successfully re-routed PO ${po.po_number} to ${recipient}`);
      }
      
      // Log the re-routing
      const client2 = await this.pool.connect();
      try {
        await client2.query(
          `INSERT INTO email_rerouting_log 
           (po_id, original_tracking_code, recipient_email, sent_date, status)
           VALUES ($1, $2, $3, NOW(), 'sent')`,
          [poId, trackingCode, recipient]
        );
      } catch (error) {
        // Table might not exist, attempt to create it
        if (error.message.includes('relation "email_rerouting_log" does not exist')) {
          console.log('Creating email_rerouting_log table...');
          await client2.query(`
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
          
          // Try insert again
          await client2.query(
            `INSERT INTO email_rerouting_log 
             (po_id, original_tracking_code, recipient_email, sent_date, status)
             VALUES ($1, $2, $3, NOW(), 'sent')`,
            [poId, trackingCode, recipient]
          );
        } else {
          throw error;
        }
      } finally {
        client2.release();
      }
      
    } catch (error) {
      console.error('Error re-routing approved PO:', error);
    }
  }

  // Get all tracking records for a PO
  async getTrackingRecordsForPO(poId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM po_email_tracking 
        WHERE po_id = $1
        ORDER BY sent_date DESC`,
        [poId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting tracking records for PO:', error);
      throw error;
    }
  }
  
  // Update the status of a tracking record
  async updateTrackingStatus(trackingId, status) {
    try {
      const result = await this.pool.query(
        `UPDATE po_email_tracking 
        SET status = $1
        WHERE tracking_id = $2
        RETURNING *`,
        [status, trackingId]
      );
      console.log(`Updated tracking record #${trackingId} status to ${status}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating tracking status:', error);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new EmailTrackingService(); 