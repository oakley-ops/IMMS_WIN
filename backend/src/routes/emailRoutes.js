const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const emailTrackingService = require('../services/emailTrackingService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');
const { generatePurchaseOrderPDF } = require('../utils/pdfGenerator');

// Make sure emailService is initialized
emailService.initializeEmailTracking();

/**
 * @route POST /api/v1/email/send-email
 * @desc Send a purchase order PDF via email
 * @access Private
 */
router.post('/send-email', authenticateToken, async (req, res) => {
  try {
    const { pdfBase64, recipient, poNumber, poId, notes } = req.body;

    // Validate required data
    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF data is required' });
    }

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!poNumber) {
      return res.status(400).json({ error: 'Purchase order number is required' });
    }

    if (!poId) {
      return res.status(400).json({ error: 'Purchase order ID is required' });
    }

    // Send the email
    await emailService.sendPurchaseOrderPDF(recipient, poNumber, pdfBase64, poId, notes);

    // Log the activity
    console.log(`Purchase order request #${poNumber} sent via email to ${recipient}`);

    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Purchase order PDF sent successfully',
      details: {
        recipient,
        poNumber,
        poId,
        hasNotes: !!notes
      }
    });

  } catch (error) {
    console.error('Error sending purchase order email:', error);
    
    // Determine the appropriate status code and message
    let statusCode = 500;
    let errorMessage = 'Failed to send email';
    
    // Check if this was a connection error
    if (error.code === 'ENOTCONNECTED' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.code === 'ESOCKET' || error.code === 'EDNS') {
      // For connection errors, we'll return a 503 Service Unavailable
      statusCode = 503;
      errorMessage = error.clientMessage || 'Unable to send email: Connection error. The email has been queued and will be sent automatically when connection is restored.';
    } else if (error.code === '42P01') {
      // Database table doesn't exist
      errorMessage = 'Database setup issue. Please run the database migration scripts.';
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage, 
      details: error.message,
      code: error.code || 'UNKNOWN',
      isQueued: statusCode === 503 // Indicate the message is queued for later sending
    });
  }
});

/**
 * @route POST /api/v1/email/process-approval
 * @desc Process email approval/rejection
 * @access Private
 */
router.post('/process-approval', authenticateToken, async (req, res) => {
  try {
    const { trackingCode, approvalEmail, action } = req.body;

    // Validate required data
    if (!trackingCode) {
      return res.status(400).json({ error: 'Tracking code is required' });
    }

    if (!approvalEmail) {
      return res.status(400).json({ error: 'Approval email is required' });
    }

    if (!action || !['approved', 'rejected'].includes(action.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid action. Must be "approved" or "rejected"' });
    }

    // Process the approval
    const result = await emailTrackingService.processEmailApproval(
      trackingCode,
      approvalEmail,
      action.toLowerCase() === 'approved'
    );

    return res.status(200).json({
      success: true,
      message: `Purchase order ${action} successfully`,
      details: result
    });

  } catch (error) {
    console.error('Error processing email approval:', error);
    return res.status(500).json({
      error: 'Failed to process approval',
      details: error.message
    });
  }
});

/**
 * @route GET /api/v1/email/history/:poId
 * @desc Get email history for a purchase order
 * @access Private
 */
router.get('/history/:poId', authenticateToken, async (req, res) => {
  try {
    const { poId } = req.params;

    // Set cache control headers to prevent caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Get email history
    const history = await emailTrackingService.getPOEmailHistory(poId);

    return res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error fetching email history:', error);
    return res.status(500).json({
      error: 'Failed to fetch email history',
      details: error.message
    });
  }
});

// Add a route for manual email approval processing
router.post('/manual-approval', authenticateToken, async (req, res) => {
  try {
    const { trackingCode, approverEmail, isApproved } = req.body;
    
    if (!trackingCode || !approverEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tracking code and approver email are required' 
      });
    }
    
    // Process the approval
    const result = await emailTrackingService.processEmailApproval(
      trackingCode,
      approverEmail,
      isApproved !== false // Default to approval if not explicitly set to false
    );
    
    res.json({ 
      success: true, 
      message: `Purchase order ${isApproved !== false ? 'approved' : 'rejected'} successfully`,
      result
    });
  } catch (error) {
    console.error('Error processing manual approval:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test endpoint for email functionality - DEVELOPMENT ONLY
router.get('/test-email', authenticateToken, async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    // Use the singleton instance instead of creating a new one
    // Initialize the email tracking service to ensure it's available
    emailService.initializeEmailTracking();

    const recipient = req.query.email || process.env.NOTIFICATION_RECIPIENTS.split(',')[0];

    console.log(`Testing email functionality to: ${recipient}`);

    const result = await emailService.sendEmail(
      'Email System Test',
      `<h1>Test Email</h1>
       <p>This is a test email to verify the email system functionality.</p>
       <p>If you received this email, the system is working correctly.</p>
       <p>Sent at: ${new Date().toLocaleString()}</p>`,
      recipient
    );

    res.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        recipient,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to manually test approval processing - DEVELOPMENT ONLY
router.post('/debug-approval', authenticateToken, async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const { trackingCode, approvalEmail, emailBody } = req.body;

    if (!trackingCode || !approvalEmail || !emailBody) {
      return res.status(400).json({
        success: false,
        error: 'trackingCode, approvalEmail, and emailBody are required'
      });
    }

    console.log('=== DEBUG APPROVAL PROCESSING ===');
    console.log('Tracking Code:', trackingCode);
    console.log('Approval Email:', approvalEmail);
    // SECURITY: Don't log full email body in production

    // Test the approval keyword detection logic
    const bodyLower = emailBody.toLowerCase();
    const bodyLines = emailBody.split('\n').map(line => line.trim().toLowerCase());

    // Define approval keywords (same as in monitorEmails.js)
    const approvalKeywords = ['approved', 'approval', 'accept', 'accepted', 'yes', 'confirm', 'confirmed',
                             'looks good', 'i approve', 'approve', 'ok', 'good', 'fine', 'agreed', 'correct'];

    // Test approval detection
    const hasApprovalInLines = bodyLines.some(line =>
      approvalKeywords.some(keyword => line.includes(keyword))
    );

    const hasApprovalInBody = approvalKeywords.some(keyword => bodyLower.includes(keyword));
    const isApproved = hasApprovalInLines || hasApprovalInBody;

    // Actually process the approval
    const result = await emailTrackingService.processEmailApproval(
      trackingCode,
      approvalEmail,
      isApproved,
      emailBody
    );

    res.json({
      success: true,
      message: 'Debug approval processing completed',
      analysis: {
        hasApprovalInLines,
        hasApprovalInBody,
        isApproved,
        foundKeywords: isApproved ? approvalKeywords.filter(keyword => bodyLower.includes(keyword)) : []
      },
      result
    });

  } catch (error) {
    console.error('Debug approval processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
      // SECURITY: Don't expose stack traces
    });
  }
});

/**
 * Route to send a purchase order email with PDF attachment
 */
router.post('/purchase-order', authenticateToken, async (req, res) => {
  try {
    const { recipient, poNumber, pdfBase64, poId } = req.body;
    
    if (!recipient || !poNumber || !pdfBase64 || !poId) {
      return res.status(400).json({ error: 'Missing required fields for email' });
    }
    
    // Use the existing email service to send the PO
    await emailService.sendPurchaseOrderPDF(recipient, poNumber, pdfBase64, poId);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending purchase order email:', error);
    
    // Determine the appropriate status code and message
    let statusCode = 500;
    let errorMessage = 'Failed to send email';
    
    // Check if this was a connection error
    if (error.code === 'ENOTCONNECTED' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.code === 'ESOCKET' || error.code === 'EDNS') {
      // For connection errors, we'll return a 503 Service Unavailable
      statusCode = 503;
      errorMessage = error.clientMessage || 'Unable to send email: Connection error. The email has been queued and will be sent automatically when connection is restored.';
    } else if (error.code === '42P01') {
      // Database table doesn't exist
      errorMessage = 'Database setup issue. Please run the database migration scripts.';
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage, 
      details: error.message,
      code: error.code || 'UNKNOWN',
      isQueued: statusCode === 503 // Indicate the message is queued for later sending
    });
  }
});

// Make sure emailService is initialized
emailService.initializeEmailTracking();

// Route for sending a general email (for testing purposes)
router.post('/send-general-email',
  authenticateToken,
  [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('html').trim().notEmpty().withMessage('HTML content is required'),
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('recipients.*').isEmail().withMessage('All recipients must be valid emails')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subject, html, recipients } = req.body;
      
      // Use the recipients array directly or fall back to single recipient
      const to = recipients || req.body.recipient;
      
      // Send the email
      const result = await emailService.sendEmail(subject, html, to);
      
      // Return success response
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({
        error: 'Failed to send email',
        details: error.message
      });
    }
  }
);

// Status endpoint to check email monitor status
router.get('/monitor-status', authenticateToken, async (req, res) => {
  try {
    // Check if email monitor process is running
    const isProcessRunning = global.emailMonitorProcess && !global.emailMonitorProcess.killed;
    
    // Check if we can access the tracking service
    let trackingServiceStatus = 'unknown';
    try {
      if (emailTrackingService && emailTrackingService.pool) {
        // Test database connection
        const result = await emailTrackingService.pool.query('SELECT NOW()');
        trackingServiceStatus = result.rows.length > 0 ? 'connected' : 'disconnected';
      }
    } catch (error) {
      trackingServiceStatus = `error: ${error.message}`;
    }
    
    // Check IMAP configuration
    const imapConfigured = !!(process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST);
    
    res.json({
      success: true,
      status: {
        emailMonitorProcess: {
          running: isProcessRunning,
          pid: global.emailMonitorProcess?.pid || null,
          killed: global.emailMonitorProcess?.killed || false
        },
        trackingService: {
          status: trackingServiceStatus
        },
        imapConfiguration: {
          configured: imapConfigured,
          user: process.env.IMAP_USER ? 'SET' : 'NOT SET',
          password: process.env.IMAP_PASSWORD ? 'SET' : 'NOT SET',
          host: process.env.IMAP_HOST || 'NOT SET',
          port: process.env.IMAP_PORT || 'NOT SET',
          secure: process.env.IMAP_SECURE || 'NOT SET'
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error checking email monitor status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force restart email monitor endpoint
router.post('/restart-monitor', authenticateToken, async (req, res) => {
  try {
    console.log('Manual restart of email monitor requested...');
    
    // Kill existing process if running
    if (global.emailMonitorProcess && !global.emailMonitorProcess.killed) {
      console.log('Killing existing email monitor process...');
      global.emailMonitorProcess.kill('SIGTERM');
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Start email monitor using the same logic as in index.js
    if (process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST) {
      try {
        const path = require('path');
        const monitorPath = path.resolve(__dirname, '..', 'scripts', 'monitorEmails.js');
        
        console.log(`Starting email monitor from path: ${monitorPath}`);
        
        // Delete from cache to ensure fresh load
        delete require.cache[require.resolve(monitorPath)];
        
        // Start the email monitor
        require(monitorPath);
        console.log('Email monitoring service restarted successfully');
        
        res.json({
          success: true,
          message: 'Email monitor restarted successfully',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Failed to restart email monitor:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'IMAP configuration not found',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error restarting email monitor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force refresh purchase order status endpoint
router.post('/refresh-po/:poId', authenticateToken, async (req, res) => {
  try {
    const poId = parseInt(req.params.poId);
    
    if (!poId || isNaN(poId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PO ID'
      });
    }
    
    // Get current PO status from database
    const result = await emailTrackingService.pool.query(
      'SELECT po_id, po_number, status, approval_status, approved_by, approval_date, updated_at FROM purchase_orders WHERE po_id = $1',
      [poId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
    }
    
    const po = result.rows[0];
    
    console.log(`Forcing refresh for PO ${poId}:`, po);
    
    // Emit socket events to force frontend update
    const updateData = {
      po_id: po.po_id,
      status: po.status,
      approval_status: po.approval_status,
      approved_by: po.approved_by,
      approval_date: po.approval_date,
      updated_at: po.updated_at
    };
    
    // Emit via both methods to ensure delivery
    if (global.io) {
      global.io.emit('purchase_order_update', updateData);
      global.io.emit('po_status_changed', updateData);
      global.io.emit('dashboard-update', {
        type: 'purchase_order_refresh',
        po_id: po.po_id
      });
      console.log('Emitted force refresh events via global.io');
    }
    
    // Also try via emailTrackingService
    emailTrackingService.emitSocketEvent('purchase_order_update', updateData);
    emailTrackingService.emitSocketEvent('po_status_changed', updateData);
    emailTrackingService.emitSocketEvent('dashboard-update', {
      type: 'purchase_order_refresh',
      po_id: po.po_id
    });
    
    res.json({
      success: true,
      message: 'Purchase order status refreshed',
      data: po
    });
    
  } catch (error) {
    console.error('Error refreshing PO status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current PO status endpoint
router.get('/po-status/:poId', authenticateToken, async (req, res) => {
  try {
    const poId = parseInt(req.params.poId);
    
    if (!poId || isNaN(poId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PO ID'
      });
    }
    
    // Get current PO status from database
    const result = await emailTrackingService.pool.query(
      'SELECT po_id, po_number, status, approval_status, approved_by, approval_date, updated_at FROM purchase_orders WHERE po_id = $1',
      [poId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error getting PO status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 