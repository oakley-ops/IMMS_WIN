const nodemailer = require('nodemailer');
const emailTrackingService = require('./emailTrackingService');
const { Pool } = require('pg');

class EmailService {
  constructor() {
    // Initialize database pool
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Initialize primary email transporter with increased timeouts
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      // Significantly increase timeout settings
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      // Add TLS options for better security
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      },
      // Add pool configuration
      pool: true,               // Use pooled connections
      maxConnections: 5,        // Maximum number of connections to pool
      maxMessages: 100,         // Maximum number of messages per connection
      // Add debug option for troubleshooting
      debug: process.env.NODE_ENV === 'development'
    });
    
    // Create a fallback transporter for when primary fails
    // This uses a different service as backup
    if (process.env.FALLBACK_SMTP_HOST) {
      this.fallbackTransporter = nodemailer.createTransport({
        host: process.env.FALLBACK_SMTP_HOST,
        port: process.env.FALLBACK_SMTP_PORT,
        secure: process.env.FALLBACK_SMTP_SECURE === 'true',
        auth: {
          user: process.env.FALLBACK_SMTP_USER,
          pass: process.env.FALLBACK_SMTP_PASSWORD,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    // Verify connection on startup
    this.verifyConnection();

    // Email recipients for inventory notifications
    this.notificationRecipients = process.env.NOTIFICATION_RECIPIENTS?.split(',') || [];
    
    // Initialize email tracking service immediately
    this.initializeEmailTracking();

    // Initialize connection status
    this.isConnected = false;
    this.lastConnectionCheck = 0;
    this.checkInternetConnectionInterval();
  }

  // Initialize email tracking service
  initializeEmailTracking() {
    if (!emailTrackingService) {
      try {
        console.log('Initializing email tracking service...');
        emailTrackingService.setEmailService(this);
        console.log('Email tracking service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize email tracking service:', error);
      }
    }
    return emailTrackingService;
  }

  // Get email tracking service, initializing if needed
  getEmailTrackingService() {
    if (!emailTrackingService) {
      this.initializeEmailTracking();
    }
    return emailTrackingService;
  }

  // Add a connection verification method
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (error) {
      console.error('Failed to verify SMTP connection:', error);
      console.error('Please check your email configuration settings');
    }
  }

  async sendLowStockNotification(part) {
    const subject = `Low Stock Alert: ${part.name}`;
    const html = `
      <h2>Low Stock Alert</h2>
      <p>The following part is running low on stock:</p>
      <ul>
        <li><strong>Part Name:</strong> ${part.name}</li>
        <li><strong>Part Number:</strong> ${part.fiserv_part_number || 'N/A'}</li>
        <li><strong>Current Quantity:</strong> ${part.quantity}</li>
        <li><strong>Minimum Quantity:</strong> ${part.minimum_quantity}</li>
        <li><strong>Location:</strong> ${part.location || 'N/A'}</li>
      </ul>
      <p>Please restock this item soon to maintain adequate inventory levels.</p>
    `;

    return this.sendEmail(subject, html);
  }

  async sendOutOfStockNotification(part) {
    const subject = `Out of Stock Alert: ${part.name}`;
    const html = `
      <h2>Out of Stock Alert</h2>
      <p>The following part is now out of stock:</p>
      <ul>
        <li><strong>Part Name:</strong> ${part.name}</li>
        <li><strong>Part Number:</strong> ${part.fiserv_part_number || 'N/A'}</li>
        <li><strong>Minimum Quantity Required:</strong> ${part.minimum_quantity}</li>
        <li><strong>Location:</strong> ${part.location || 'N/A'}</li>
      </ul>
      <p>Please restock this item as soon as possible to prevent disruptions.</p>
    `;

    return this.sendEmail(subject, html);
  }

  // Check internet connection using DNS lookup
  async checkInternetConnection() {
    const dns = require('dns');
    const util = require('util');
    const lookup = util.promisify(dns.lookup);
    
    try {
      // Try to resolve a reliable domain
      await lookup('google.com');
      
      // If successful, we have internet connection
      if (!this.isConnected) {
        console.log('Internet connection established');
      }
      this.isConnected = true;
      this.lastConnectionCheck = Date.now();
      return true;
    } catch (error) {
      // If there's an error, no internet connection
      if (this.isConnected) {
        console.error('Internet connection lost');
      }
      this.isConnected = false;
      this.lastConnectionCheck = Date.now();
      return false;
    }
  }
  
  // Start a background interval to check internet connectivity
  checkInternetConnectionInterval() {
    // Check connection every minute
    setInterval(async () => {
      await this.checkInternetConnection();
    }, 60000); // Check every minute
    
    // Do an immediate check
    this.checkInternetConnection();
  }

  async sendPurchaseOrderPDF(recipient, poNumber, pdfBase64, poId, notes) {
    console.log('Starting sendPurchaseOrderPDF...');
    console.log('PO ID:', poId);
    console.log('PO Number:', poNumber);
    console.log('Recipient:', recipient);
    console.log('Notes included:', !!notes);
    
    // Make sure email tracking service is initialized
    const trackingService = this.getEmailTrackingService();
    if (!trackingService) {
      throw new Error('Email tracking service is not initialized');
    }
    
    // Create tracking record
    console.log('Creating tracking record...');
    const trackingRecord = await trackingService.createTrackingRecord(
      poId,
      recipient,
      `Purchase Order #${poNumber}`,
      pdfBase64,
      notes // Pass notes to be stored with the tracking record
    );
    console.log('Tracking record created:', trackingRecord);

    const subject = `Purchase Order Request #${poNumber} [PO-APPROVAL-${trackingRecord.tracking_code}]`;
    console.log('Email subject:', subject);
    
    // Create a completely new template without any REJECT option
    let html = `
      <h2>Purchase Order #${poNumber}</h2>
      <p>Please find attached the purchase order document for your review and approval.</p>
      
      ${notes ? `
      <div style="margin: 20px 0; padding: 15px; background-color: #e8f4ff; border-left: 4px solid #0078d4; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #0078d4;">Additional Notes</h3>
        <p style="white-space: pre-line;">${notes}</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
        <h3>Approval Instructions</h3>
        <p>Please reply to this email with your decision:</p>
        <ul>
          <li><strong>APPROVE:</strong> Include words like "approve", "accepted", "confirmed", etc. in your reply</li>
          <li><strong>PUT ON HOLD:</strong> Include words like "on hold", "need changes", "revise", etc. in your reply if changes are needed</li>
        </ul>
        <p>You can include any additional comments or questions in your reply. The system will automatically process your response.</p>
        <p><strong>Note:</strong> Only the original recipient (${recipient}) can respond to this purchase order request.</p>
      </div>
      
      <p>This is an automated message from the Fiserv Inventory Management System.</p>
    `;

    try {
      console.log(`Attempting to send purchase order #${poNumber} to ${recipient}`);
      
      // Check for required data
      if (!pdfBase64) {
        throw new Error('PDF data is empty or null');
      }
      
      // Check internet connection before attempting to send
      const isOnline = await this.checkInternetConnection();
      if (!isOnline) {
        const error = new Error('No internet connection available');
        error.code = 'ENOTCONNECTED';
        
        // Store the email for later sending when connection is restored
        await trackingService.storeFailedEmailAttempt({
          recipient,
          subject,
          html,
          pdfBase64,
          poId,
          poNumber,
          errorMessage: error.message
        });
        
        // Start background retry process
        this.startBackgroundRetryProcess();
        
        throw error;
      }
      
      // Prepare email data
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
        to: recipient,
        subject,
        html,
        attachments: [
          {
            filename: `PO-${poNumber}.pdf`,
            content: pdfBase64,
            encoding: 'base64'
          }
        ]
      };
      
      // Implement retry logic with primary and fallback transporters
      let retries = 3;
      let lastError = null;
      let useFallback = false;
      
      while (retries > 0) {
        try {
          // Choose which transporter to use
          const transporter = useFallback && this.fallbackTransporter ? 
            this.fallbackTransporter : this.transporter;
          
          console.log(`Using ${useFallback ? 'fallback' : 'primary'} email transporter (${retries} retries left)`);
          
          const info = await transporter.sendMail(mailOptions);
          
          console.log('Purchase order email sent:', info.messageId);
          
          // Update tracking record to show successful delivery
          await trackingService.updateTrackingStatus(trackingRecord.tracking_id, 'sent');
          
          return info;
        } catch (err) {
          lastError = err;
          console.warn(`Email attempt failed (${retries} retries left):`, err.code || err.message);
          
          // Try fallback on next attempt if available
          if (this.fallbackTransporter && !useFallback) {
            console.log('Switching to fallback email transporter');
            useFallback = true;
          } else {
            retries--;
          }
          
          if (retries > 0) {
            const delay = useFallback ? 1000 : 3000;
            console.log(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we reach here, all retries failed
      // Store the failed attempt for background processing
      await trackingService.storeFailedEmailAttempt({
        recipient,
        subject,
        html,
        pdfBase64,
        poId,
        poNumber,
        errorMessage: lastError.message
      });

      // Start background retry process if not already running
      this.startBackgroundRetryProcess();

      throw lastError;
    } catch (error) {
      console.error('Error sending purchase order email:', error);
      console.error('Error details:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      
      // If this is a connection error, provide a clearer message to the client
      if (error.code === 'ENOTCONNECTED') {
        error.clientMessage = 'Unable to send email: No internet connection available. The email has been queued and will be sent automatically when connection is restored.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
        error.clientMessage = 'Unable to send email: Connection to email server failed. The email has been queued and will be sent automatically when connection is restored.';
      } else if (error.code === 'EDNS') {
        error.clientMessage = 'Unable to send email: DNS resolution failed. Please check your internet connection. The email has been queued and will be sent automatically when connection is restored.';
      }
      
      throw error;
    }
  }

  // Modified background retry process to check internet before attempting
  async startBackgroundRetryProcess() {
    if (this.retryProcessRunning) return;
    this.retryProcessRunning = true;

    const processFailedEmails = async () => {
      try {
        // Check for internet connection first
        const isOnline = await this.checkInternetConnection();
        if (!isOnline) {
          console.log('Skipping retry processing - no internet connection');
          return;
        }
        
        // Get tracking service
        const trackingService = this.getEmailTrackingService();
        if (!trackingService) {
          console.error('Email tracking service not initialized for retry process');
          return;
        }
        
        const failedAttempts = await trackingService.getFailedEmailAttempts();
        if (failedAttempts.length > 0) {
          console.log(`Attempting to send ${failedAttempts.length} queued emails...`);
        }
        
        for (const attempt of failedAttempts) {
          try {
            const mailOptions = {
              from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
              to: attempt.recipient,
              subject: attempt.subject,
              html: attempt.html_content,
              attachments: attempt.pdf_data ? [{
                filename: `PO-${attempt.po_number}.pdf`,
                content: attempt.pdf_data,
                encoding: 'base64'
              }] : []
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Retried email sent successfully:', info.messageId);
            await trackingService.markEmailAttemptAsProcessed(attempt.id, true);
            
            // If we have a PO ID, also update its tracking record
            if (attempt.po_id) {
              const trackingRecords = await trackingService.getTrackingRecordsForPO(attempt.po_id);
              if (trackingRecords && trackingRecords.length > 0) {
                await trackingService.updateTrackingStatus(trackingRecords[0].tracking_id, 'sent');
              }
            }
          } catch (error) {
            console.error('Error retrying failed email:', error);
            
            // Only mark as failed for non-connection errors, otherwise we'll retry again
            if (error.code !== 'ENOTCONNECTED' && error.code !== 'ECONNREFUSED' &&
                error.code !== 'ETIMEDOUT' && error.code !== 'ESOCKET' && error.code !== 'EDNS') {
              await trackingService.markEmailAttemptAsProcessed(attempt.id, false);
            }
          }
        }
      } catch (error) {
        console.error('Error in background retry process:', error);
      }
    };

    // Run immediately and then every minute
    await processFailedEmails();
    setInterval(processFailedEmails, 60000); // Check every minute
  }

  async getPurchaseOrderData(poId) {
    const client = await this.pool.connect();
    try {
      // Get the purchase order details
      const poResult = await client.query(
        `SELECT po.*, 
                v.name as vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                v.address as vendor_address
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
         WHERE po.po_id = $1`,
        [poId]
      );

      if (poResult.rows.length === 0) {
        throw new Error('Purchase order not found');
      }

      const po = poResult.rows[0];

      // Get the parts for this PO
      const partsResult = await client.query(
        `SELECT p.*, po.quantity as order_quantity
         FROM parts p
         JOIN po_parts po ON p.part_id = po.part_id
         WHERE po.po_id = $1`,
        [poId]
      );

      return {
        ...po,
        parts: partsResult.rows
      };
    } finally {
      client.release();
    }
  }

  async sendEmail(subject, html, recipient = null) {
    // Use provided recipient or fall back to notification recipients
    const emailRecipients = recipient || this.notificationRecipients;
    
    if (!emailRecipients || (Array.isArray(emailRecipients) && emailRecipients.length === 0)) {
      console.warn('No notification recipients configured');
      return;
    }

    const to = Array.isArray(emailRecipients) ? emailRecipients.join(', ') : emailRecipients;
    
    try {
      console.log(`Sending email to: ${to}`);
      console.log(`Email configuration: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} (${process.env.SMTP_USER})`);
      
      // Implement retry logic
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          const info = await this.transporter.sendMail({
            from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
            to,
            subject,
            html,
          });
          
          console.log('Email sent:', info.messageId);
          return info;
        } catch (err) {
          lastError = err;
          console.warn(`Email attempt failed (${retries} retries left):`, err.code || err.message);
          retries--;
          
          if (retries > 0) {
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // If we reach here, all retries failed
      throw lastError;
    } catch (error) {
      console.error('Error sending email:', error);
      console.error('Error details:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      throw error;
    }
  }
  
  // Direct email sending without tracking record creation
  // Used for rerouting to avoid email loops
  async sendEmailDirect(mailOptions) {
    try {
      // Check internet connection before attempting to send
      const isOnline = await this.checkInternetConnection();
      if (!isOnline) {
        const error = new Error('No internet connection available');
        error.code = 'ENOTCONNECTED';
        throw error;
      }
      
      // Make sure there's a from address
      if (!mailOptions.from) {
        mailOptions.from = process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>';
      }
      
      console.log(`Sending direct email to: ${mailOptions.to}`);
      
      // Implement retry logic
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          const info = await this.transporter.sendMail(mailOptions);
          console.log('Direct email sent:', info.messageId);
          return info;
        } catch (err) {
          lastError = err;
          console.warn(`Direct email attempt failed (${retries} retries left):`, err.code || err.message);
          retries--;
          
          if (retries > 0) {
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // If we reach here, all retries failed
      throw lastError;
    } catch (error) {
      console.error('Error sending direct email:', error);
      console.error('Error details:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      throw error;
    }
  }
}

module.exports = new EmailService(); 