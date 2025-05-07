// Get services
const EmailService = require('./src/services/emailService');
const emailTrackingService = require('./src/services/emailTrackingService');

console.log('Starting email monitor...');
console.log('SMTP config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  from: process.env.SMTP_FROM,
});
console.log('Socket URL:', process.env.SOCKET_URL);

// Create an instance of EmailService
const emailService = new EmailService();

// Manually connect services using the proper method
console.log('Setting email service in tracking service...');
// Make sure to use the proper method, not the property
emailTrackingService.setEmailService(emailService);
console.log('Email service set via method');

// Verify the connection
console.log('Email service connection check:', 
  emailTrackingService.emailService ? 'CONNECTED' : 'NOT CONNECTED');

// Setup Socket.IO client
if (process.env.SOCKET_URL) {
  console.log('Setting up Socket.IO client...');
  const { io } = require('socket.io-client');
  const socket = io(process.env.SOCKET_URL);
  
  socket.on('connect', () => {
    console.log('Email monitor connected to Socket.IO server at', process.env.SOCKET_URL);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
  });
  
  // Make socket available globally for both methods
  global.socket = socket;
  global.io = socket; // For backward compatibility
  
  // Force set in the tracking service
  emailTrackingService.socketIo = socket;
  
  console.log('Socket.IO client initialized');
}

// Start monitoring
console.log('Starting email monitoring service...');
const IMAPClient = require('./src/services/imapService');
const emailMonitor = new IMAPClient(emailTrackingService);
emailMonitor.startMonitoring(); 