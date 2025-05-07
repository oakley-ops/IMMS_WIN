// Load environment variables first
require('dotenv').config();

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const emailTrackingService = require('../services/emailTrackingService');
const dns = require('dns');
const util = require('util');
const lookup = util.promisify(dns.lookup);

// Import the emailService (which is already instantiated) and set it in emailTrackingService
const emailService = require('../services/emailService');
// Make sure tracking service has access to the email service for rerouting
emailTrackingService.setEmailService(emailService);

// Verify environment variables are loaded
console.log('Environment variables loaded:', {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  IMAP_USER: process.env.IMAP_USER,
  IMAP_HOST: process.env.IMAP_HOST,
  IMAP_PORT: process.env.IMAP_PORT,
  IMAP_SECURE: process.env.IMAP_SECURE
});

class EmailMonitor {
  constructor() {
    console.log('Initializing EmailMonitor with IMAP config:', {
      user: process.env.IMAP_USER,
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT,
      secure: process.env.IMAP_SECURE === 'true'
    });

    // Initialize internet connection status
    this.isInternetConnected = false;
    this.lastInternetCheck = 0;
    this.lastSuccessfulCheck = 0; // Track when we last successfully checked emails
    this.connectionLostAt = null; // Track when connection was lost
    
    // Start checking internet connectivity immediately and periodically
    this.checkInternetConnectionInterval();

    // Initialize the IMAP connection
    this.initializeImap();
  }
  
  // Initialize IMAP connection with all event handlers
  initializeImap() {
    this.imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT,
      tls: process.env.IMAP_SECURE === 'true',
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 30000,
      connTimeout: 30000,
      debug: (msg) => console.log('IMAP Debug:', msg)
    });

    // Keep track of the polling interval
    this.pollingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // Set up event handlers - use on() instead of once() for reconnections
    this.imap.on('ready', () => {
      console.log('Successfully connected to email server');
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Set forceFullCheck to true to check for missed emails
      this.forceFullCheck = true;
      this.startMonitoring();
    });

    this.imap.on('error', (err) => {
      console.error('IMAP connection error:', err);
      this.handleConnectionError();
    });

    this.imap.on('end', () => {
      console.log('IMAP connection ended');
      this.handleConnectionError();
    });
  }

  // Check internet connection using DNS lookup
  async checkInternetConnection() {
    try {
      // Try to resolve a reliable domain
      await lookup('google.com');
      
      // If successful, we have internet connection
      const previouslyDisconnected = !this.isInternetConnected;
      const now = Date.now();
      
      if (previouslyDisconnected) {
        console.log('Internet connection established');
        
        // Calculate how long we were disconnected
        let downtime = 0;
        if (this.connectionLostAt) {
          downtime = Math.floor((now - this.connectionLostAt) / 1000);
          console.log(`Internet was disconnected for approximately ${downtime} seconds`);
        }
        
        // Once internet is back, try to reconnect IMAP and check for missed emails
        if (this.imap.state !== 'connected' && this.imap.state !== 'authenticated') {
          console.log('Internet connection restored. Attempting to reconnect to email server...');
          this.connect();
        } else if (this.imap.state === 'authenticated') {
          // If already connected, do an immediate check for missed emails
          console.log('Internet connection restored. Checking for any missed approval emails...');
          
          // Set a flag to perform a full check instead of just looking at new emails
          this.forceFullCheck = true;
          this.checkForApprovalEmails();
        }
        
        // Reset the connection lost timestamp
        this.connectionLostAt = null;
      }
      
      this.isInternetConnected = true;
      this.lastInternetCheck = now;
      return true;
    } catch (error) {
      // If there's an error, no internet connection
      const now = Date.now();
      
      if (this.isInternetConnected) {
        console.error('Internet connection lost');
        // Record when we lost connection
        this.connectionLostAt = now;
      }
      
      this.isInternetConnected = false;
      this.lastInternetCheck = now;
      return false;
    }
  }
  
  // Start a background interval to check internet connectivity
  checkInternetConnectionInterval() {
    // Check connection every 30 seconds
    setInterval(async () => {
      await this.checkInternetConnection();
    }, 30000);
    
    // Do an immediate check
    this.checkInternetConnection();
  }

  handleConnectionError() {
    // Check internet connection first
    this.checkInternetConnection().then(isConnected => {
      // If there's no internet, just log and wait for connectivity check to reconnect
      if (!isConnected) {
        console.log('No internet connection available. Will retry when connectivity is restored.');
        
        // Clear any existing intervals
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        
        return;
      }
      
      // If we have internet but IMAP connection failed, try normal reconnect logic
      // Clear any existing intervals
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}) in ${delay/1000} seconds...`);
        setTimeout(() => {
          console.log('Reconnecting...');
          // Set flag to check for missed emails on reconnection
          this.forceFullCheck = true;
          this.connect();
        }, delay);
      } else {
        console.error('Max reconnection attempts reached. Please check the email configuration and restart the service.');
        process.exit(1); // Exit so PM2 can restart the process
      }
    });
  }

  setupPolling() {
    // Clear any existing interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Check for new emails every 30 seconds
    this.pollingInterval = setInterval(() => {
      console.log('Polling for approval emails...');
      this.checkForApprovalEmails();
    }, 30000);

    // Initial check
    this.checkForApprovalEmails();
  }

  checkForApprovalEmails() {
    // First check if we have internet connectivity
    if (!this.isInternetConnected) {
      console.log('No internet connection. Skipping email check.');
      return;
    }
    
    if (this.imap.state !== 'authenticated') {
      console.log('Not authenticated, attempting to reconnect...');
      this.forceFullCheck = true; // Ensure we check for missed emails after reconnection
      this.connect();
      return;
    }
    
    console.log('Checking for approval emails...');
    
    // Default to searching for UNSEEN messages
    let searchCriteria = [['UNSEEN', ['OR', ['SUBJECT', 'PO-APPROVAL-'], ['SUBJECT', 'Re: PO-APPROVAL-']]]];
    
    // If this is a full check after reconnection, search for ALL messages with approval subjects
    if (this.forceFullCheck) {
      const checkWindow = 30; // Days to look back
      const date = new Date();
      date.setDate(date.getDate() - checkWindow);
      
      // Format date as DD-MMM-YYYY (e.g., "01-Jan-2023") which is the format IMAP expects
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const sinceDate = `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
      
      console.log(`Performing full check for approval emails since ${sinceDate}...`);
      
      // Correct format: array of criteria where each criterion is an array
      // SINCE is a separate criterion, not nested with OR
      searchCriteria = [
        ['SINCE', sinceDate], 
        ['OR', 
          ['SUBJECT', 'PO-APPROVAL-'], 
          ['SUBJECT', 'Re: PO-APPROVAL-']
        ]
      ];
      
      // Reset the flag after using it
      this.forceFullCheck = false;
    }
    
    this.imap.search(searchCriteria, (err, results) => {
      if (err) {
        console.error('Error searching messages:', err);
        return;
      }

      if (!results || !results.length) {
        console.log('No approval messages found - this is normal');
        // Update last successful check timestamp
        this.lastSuccessfulCheck = Date.now();
        return;
      }

      console.log('Found', results.length, 'approval messages to process');

      // Process each message
      const f = this.imap.fetch(results, {
        bodies: '',
        struct: true,
        markSeen: true
      });

      let processedCount = 0;
      let processedUIDs = [];
      
      f.on('message', (msg, seqno) => {
        let uid;
        
        // Get the UID for later use
        msg.once('attributes', (attrs) => {
          uid = attrs.uid;
          console.log(`Processing message #${seqno} (UID: ${uid})`);
        });
        
        console.log('Processing new message...');
        msg.on('body', (stream) => {
          simpleParser(stream, async (err, parsed) => {
            if (err) {
              console.error('Error parsing message:', err);
              return;
            }

            try {
              // Extract tracking code from subject, handling RE: prefix
              const cleanSubject = parsed.subject.replace(/^RE:\s*/i, '').replace(/^Re:\s*/i, '');
              const trackingCodeMatch = cleanSubject.match(/\[PO-APPROVAL-([^\]]+)\]/);
              if (!trackingCodeMatch) {
                console.log('No tracking code found in subject:', cleanSubject);
                return;
              }

              const trackingCode = trackingCodeMatch[1];
              console.log('Processing email with tracking code:', trackingCode);
              
              // Extract just the email address from the from field
              let approvalEmail = parsed.from.text;
              if (approvalEmail.includes('<') && approvalEmail.includes('>')) {
                approvalEmail = approvalEmail.match(/<([^>]+)>/)[1];
              }
              
              console.log('Processing approval from:', approvalEmail);
              console.log('Email content:', parsed.text);
              
              // Check for approval/hold keywords in the subject or body
              const subjectLower = cleanSubject.toLowerCase();
              const bodyLower = parsed.text?.toLowerCase() || '';
              const bodyLines = parsed.text?.split('\n').map(line => line.trim().toLowerCase()) || [];
              
              // Define approval and hold keywords
              const approvalKeywords = ['approved', 'approval', 'accept', 'accepted', 'yes', 'confirm', 'confirmed', 
                                     'looks good', 'i approve', 'approve', 'ok', 'good', 'fine', 'agreed', 'correct'];
              
              // Simplified approval check - if any line starts with an approval keyword
              const hasApproval = bodyLines.some(line => 
                approvalKeywords.some(keyword => line.startsWith(keyword))
              );

              // If we find an approval keyword, mark as approved
              const isApproved = hasApproval;
              console.log('Approval status:', isApproved ? 'APPROVED' : 'NOT APPROVED');
              
              try {
                await emailTrackingService.processEmailApproval(trackingCode, approvalEmail, isApproved, parsed.text);
                console.log(`Successfully processed email for tracking code ${trackingCode}`);
                processedCount++;
                
                // Store the UID of the processed message
                if (uid) {
                  processedUIDs.push(uid);
                }
              } catch (error) {
                console.error('Error processing email approval:', error);
                console.error('Error details:', error.message);
                console.error('Stack trace:', error.stack);
              }
            } catch (error) {
              console.error('Error processing email:', error);
            }
          });
        });
      });

      f.once('error', (err) => {
        if (err.message === 'Nothing to fetch') {
          console.log('No messages to fetch - this is normal');
        } else {
          console.error('Fetch error:', err);
        }
      });

      f.once('end', () => {
        console.log(`Finished processing ${processedCount} messages`);
        
        // Update last successful check timestamp
        this.lastSuccessfulCheck = Date.now();
        
        // Move processed messages to a 'Processed' mailbox to prevent reprocessing
        if (processedUIDs.length > 0) {
          console.log(`Moving ${processedUIDs.length} processed messages to 'Processed' folder...`);
          
          // First, make sure the Processed folder exists
          this.imap.getBoxes((boxErr, boxes) => {
            const hasProcessedBox = boxes && (boxes.Processed || boxes.PROCESSED || boxes.processed);
            
            const moveMessages = () => {
              this.imap.move(processedUIDs, 'Processed', (moveErr) => {
                if (moveErr) {
                  console.error('Error moving messages:', moveErr);
                  
                  // If move fails, just add a flag so we don't process these again
                  this.imap.addFlags(processedUIDs, '\\Flagged', (flagErr) => {
                    if (flagErr) {
                      console.error('Error flagging messages:', flagErr);
                    } else {
                      console.log('Added flags to processed messages');
                    }
                  });
                } else {
                  console.log('Successfully moved messages to Processed folder');
                }
              });
            };
            
            if (!hasProcessedBox) {
              // Create the Processed folder if it doesn't exist
              this.imap.addBox('Processed', (createErr) => {
                if (createErr) {
                  console.error('Error creating Processed folder:', createErr);
                } else {
                  console.log('Created Processed folder');
                  moveMessages();
                }
              });
            } else {
              moveMessages();
            }
          });
        }
      });
    });
  }

  startMonitoring() {
    // Open the inbox
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        this.handleConnectionError();
        return;
      }

      console.log('Opened inbox:', box.messages.total, 'messages');
      
      // Do a full check initially
      this.forceFullCheck = true;
      this.checkForApprovalEmails();
      
      this.setupPolling();
      
      // Set up a listener for new messages
      this.imap.on('mail', (numNewMsgs) => {
        console.log(`Received ${numNewMsgs} new messages - checking for approvals`);
        this.checkForApprovalEmails();
      });
    });
  }

  connect() {
    // Check internet connectivity first
    this.checkInternetConnection().then(isConnected => {
      if (!isConnected) {
        console.log('No internet connection available. Will try again when connectivity is restored.');
        return;
      }
      
      try {
        // Ensure we're not trying to connect an active connection
        if (this.imap.state === 'connected' || this.imap.state === 'authenticated') {
          console.log('Already connected to IMAP server. Disconnecting first...');
          this.imap.end();
          
          // Re-initialize IMAP connection with fresh event handlers
          this.initializeImap();
        }
        
        console.log('Connecting to IMAP server...');
        this.imap.connect();
      } catch (error) {
        console.error('Error connecting to IMAP server:', error);
        this.handleConnectionError();
      }
    });
  }
}

// Start the email monitor
const monitor = new EmailMonitor();

// Don't exit the process on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit - let the monitor continue running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit - let the monitor continue running
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Gracefully shutting down...');
  // Close IMAP connection if open
  if (monitor.imap && (monitor.imap.state === 'connected' || monitor.imap.state === 'authenticated')) {
    monitor.imap.end();
  }
  process.exit(0);
});

// Connect to the email server
monitor.connect(); 