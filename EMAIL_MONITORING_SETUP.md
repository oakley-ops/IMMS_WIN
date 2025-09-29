# Email Monitoring Service Setup Guide

## Overview

This guide explains how to re-enable the email monitoring service for automated purchase order approval processing via email. The email monitoring service has been disabled by default for security and resource management.

## What the Email Monitoring Service Does

- **Monitors incoming emails** for purchase order approvals/rejections
- **Automatically processes** approval responses from authorized personnel
- **Updates purchase order status** in the database based on email responses
- **Provides real-time notifications** via WebSocket connections

## Prerequisites

Before enabling email monitoring, ensure you have:

1. **Email account credentials** (IMAP access required)
2. **IMAP server details** for your email provider
3. **List of authorized approvers** (configured in the system)
4. **Network connectivity** to your email server

## Step 1: Configure Environment Variables

You need to set up the following environment variables for IMAP connection:

### Required IMAP Settings

```bash
# Email account settings
IMAP_USER=your-email@company.com
IMAP_PASSWORD=your-email-password
IMAP_HOST=imap.your-email-provider.com
IMAP_PORT=993
IMAP_SECURE=true

# Optional: Email processing settings
PROCESS_ALL_EMAILS=true
NODE_ENV=production
```

### Common IMAP Settings by Provider

#### Gmail
```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
```

#### Outlook/Office 365
```bash
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_SECURE=true
```

#### Yahoo Mail
```bash
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
IMAP_SECURE=true
```

### Setting Environment Variables

#### Windows (PowerShell)
```powershell
$env:IMAP_USER="your-email@company.com"
$env:IMAP_PASSWORD="your-password"
$env:IMAP_HOST="imap.gmail.com"
$env:IMAP_PORT="993"
$env:IMAP_SECURE="true"
```

#### Windows (Command Prompt)
```cmd
set IMAP_USER=your-email@company.com
set IMAP_PASSWORD=your-password
set IMAP_HOST=imap.gmail.com
set IMAP_PORT=993
set IMAP_SECURE=true
```

#### Linux/Mac
```bash
export IMAP_USER="your-email@company.com"
export IMAP_PASSWORD="your-password"
export IMAP_HOST="imap.gmail.com"
export IMAP_PORT="993"
export IMAP_SECURE="true"
```

#### Using .env File (Recommended)
Create a `.env` file in the `backend` directory:

```env
# Email Configuration
IMAP_USER=your-email@company.com
IMAP_PASSWORD=your-email-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
PROCESS_ALL_EMAILS=true

# Other existing environment variables...
DB_USER=your-db-user
DB_PASSWORD=your-db-password
# ... etc
```

## Step 2: Enable Email Monitoring in Code

### 2.1 Enable in Main Server File

Edit `backend/index.js` and uncomment the email monitoring code:

**Find this section (around line 510):**
```javascript
// Start email monitoring automatically if IMAP credentials are configured
// EMAIL MONITORING DISABLED - To re-enable, uncomment the code below and configure IMAP settings
/*
if (process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST) {
```

**Replace with:**
```javascript
// Start email monitoring automatically if IMAP credentials are configured
if (process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST) {
```

**Also find this section (around line 549):**
```javascript
} else {
  console.log('IMAP configuration not found. Email monitoring disabled.');
}
*/
console.log('Email monitoring disabled by configuration.');
```

**Replace with:**
```javascript
} else {
  console.log('IMAP configuration not found. Email monitoring disabled.');
}
```

**And remove these lines:**
```javascript
console.log('Email monitoring disabled by configuration.');
console.log('To enable automatic email approval detection, configure IMAP_USER, IMAP_PASSWORD, and IMAP_HOST environment variables.');
```

### 2.2 Enable PM2 Process (Optional)

If you want to run email monitoring as a separate process using PM2, edit `backend/ecosystem.config.js`:

**Uncomment the email monitor configuration:**
```javascript
module.exports = {
  apps: [
    {
      name: "email-monitor",
      script: "./src/scripts/monitorEmails.js",
      watch: true,
      max_memory_restart: "1G",
      restart_delay: 5000,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PROCESS_ALL_EMAILS: "true"
      },
      error_file: "logs/email-monitor-error.log",
      out_file: "logs/email-monitor-out.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      node_args: "--trace-warnings",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      exp_backoff_restart_delay: 100
    }
  ]
}
```

## Step 3: Configure Authorized Approvers

Edit `backend/src/services/emailTrackingService.js` to add authorized email addresses:

```javascript
// List of authorized approvers
this.authorizedApprovers = [
  'manager@company.com',
  'supervisor@company.com',
  'director@company.com',
  // Add more authorized email addresses here
].filter(Boolean);
```

## Step 4: Test the Configuration

### 4.1 Test IMAP Connection

Run the IMAP connection test:

```bash
cd backend
node test-imap-connection.js
```

Expected output:
```
✅ IMAP Connection Successful!
Connection established in XXXms
✅ Successfully opened inbox
Inbox has XX messages
✅ Search successful - found X unseen messages
🎉 All tests passed! IMAP connection is working properly.
```

### 4.2 Start the Server

```bash
cd backend
npm start
```

Look for these messages in the startup logs:
```
Starting email monitoring service...
[EmailMonitor] Starting email monitor in integrated mode...
[EmailMonitor] Loading email monitor module...
Successfully connected to email server
[EmailMonitor] Email monitoring service started successfully (integrated mode)
```

### 4.3 Test Email Processing

1. Send a test purchase order approval email to your configured email address
2. Check the server logs for email processing messages
3. Verify that purchase order status updates in the database

## Step 5: Running Options

### Option 1: Integrated Mode (Default)
Email monitoring runs within the main server process:
```bash
npm start
```

### Option 2: Separate Process
Run email monitoring as a separate Node.js process:
```bash
npm run start:email-monitor
```

### Option 3: Both Processes
Run both main server and email monitor separately:
```bash
npm run start:all
```

### Option 4: PM2 Process Manager
Use PM2 for production deployment:
```bash
pm2 start ecosystem.config.js
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
Error: Invalid credentials
```
**Solution:** 
- Verify email address and password
- For Gmail: Use App Password instead of regular password
- For Office 365: Ensure IMAP is enabled

#### 2. Connection Timeout
```
Error: connection timeout
```
**Solution:**
- Check firewall settings
- Verify IMAP host and port
- Ensure network connectivity

#### 3. TLS/SSL Errors
```
Error: unable to verify the first certificate
```
**Solution:**
- Set `IMAP_SECURE=true`
- Check if your email provider requires specific TLS settings

#### 4. Module Not Found
```
Error: Cannot find module
```
**Solution:**
- Run `npm install` to install dependencies
- Verify you're in the correct directory (`backend`)

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will show detailed IMAP connection and email processing logs.

### Monitoring Logs

Check the log files for detailed information:
- `backend/logs/email-monitor-out.log` - Standard output
- `backend/logs/email-monitor-error.log` - Error messages
- `backend/logs/combined.log` - Application logs

## Security Considerations

1. **Use App Passwords**: For Gmail and other providers, use app-specific passwords
2. **Secure Storage**: Store credentials securely (environment variables, not in code)
3. **Network Security**: Ensure secure connection to email servers
4. **Access Control**: Limit authorized approvers to trusted personnel
5. **Monitoring**: Regularly monitor email processing logs for suspicious activity

## Performance Tuning

### Email Polling Frequency
Modify `backend/src/scripts/monitorEmails.js` to adjust polling:
```javascript
// Check for new emails every 30 seconds (default)
this.pollingInterval = setInterval(() => {
  this.checkForNewEmails();
}, 30000);
```

### Memory Management
The email monitor is configured with:
- Maximum memory restart: 1GB
- Maximum restarts: 10
- Exponential backoff on restart

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Test IMAP connection using the test script
4. Verify environment variables are correctly set
5. Ensure authorized approvers are properly configured

For additional help, check the application logs and error messages for specific guidance.

