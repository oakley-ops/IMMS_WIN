require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSimpleEmail() {
  console.log('Testing simple email sending');
  console.log('-----------------------------------');
  console.log('Environment variables:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_FROM:', process.env.SMTP_FROM);
  console.log('REROUTE_EMAIL:', process.env.REROUTE_EMAIL);
  console.log('-----------------------------------');
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      // Add debug option for troubleshooting
      debug: true,
      logger: true
    });
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    // Send test email
    console.log(`Sending test email to ${process.env.REROUTE_EMAIL}...`);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Fiserv Inventory" <ftenashville@gmail.com>',
      to: process.env.REROUTE_EMAIL,
      subject: 'Simple Test Email',
      html: '<p>This is a simple test email.</p>'
    });
    
    console.log('Email sent successfully');
    console.log('Message ID:', info.messageId);
    console.log('Full response:', info);
    
  } catch (error) {
    console.error('Error during email test:');
    console.error(error);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.response) {
      console.error('Error response:', error.response);
    }
    if (error.responseCode) {
      console.error('Error response code:', error.responseCode);
    }
  }
}

testSimpleEmail().catch(console.error); 