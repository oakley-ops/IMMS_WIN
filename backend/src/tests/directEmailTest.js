// Direct email test - bypassing the re-routing mechanism
require('dotenv').config();

const emailService = require('../services/emailService');

console.log('Starting direct email test...');
console.log('Email configuration:', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER);
console.log('Sending email directly to: ikerodz@gmail.com');

// Using parameter order: subject, html, recipient
emailService.sendEmail(
  'Direct Test Email - Parameter Style',
  `
  <p>This is a direct test email sent at ${new Date().toLocaleString()}</p>
  <p>Testing direct email delivery without the re-routing mechanism</p>
  `,
  'ikerodz@gmail.com'  // Explicitly set recipient as third parameter
)
.then(() => {
  console.log('Direct test email sent successfully');
})
.catch(err => {
  console.error('Email error:', err);
}); 