require('dotenv').config();
const Imap = require('imap');

console.log('=== IMAP Connection Test ===\n');

console.log('Testing IMAP connection with settings:');
console.log({
  user: process.env.IMAP_USER,
  host: process.env.IMAP_HOST,
  port: process.env.IMAP_PORT,
  secure: process.env.IMAP_SECURE === 'true'
});

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASSWORD,
  host: process.env.IMAP_HOST,
  port: process.env.IMAP_PORT,
  tls: process.env.IMAP_SECURE === 'true',
  tlsOptions: { 
    rejectUnauthorized: false,
    enableTrace: false,
    requestCert: true,
    minVersion: 'TLSv1.2'
  },
  authTimeout: 60000,  // 60 seconds
  connTimeout: 60000,  // 60 seconds
  keepalive: {
    interval: 10000,   // Send keep-alive every 10 seconds
    idleInterval: 300000, // Keep connection alive for 5 minutes when idle
    forceNoop: true    // Send NOOP commands to keep connection alive
  },
  debug: (msg) => console.log('IMAP Debug:', msg)
});

let testStartTime = Date.now();
let connectionSuccessful = false;

imap.once('ready', function() {
  console.log('\n✅ IMAP Connection Successful!');
  const connectTime = Date.now() - testStartTime;
  console.log(`Connection established in ${connectTime}ms`);
  connectionSuccessful = true;
  
  // Test opening inbox
  imap.openBox('INBOX', true, function(err, box) {
    if (err) {
      console.error('❌ Failed to open inbox:', err);
    } else {
      console.log('✅ Successfully opened inbox');
      console.log(`Inbox has ${box.messages.total} messages`);
      
      // Test a simple search
      console.log('Testing search functionality...');
      imap.search(['UNSEEN'], function(err, results) {
        if (err) {
          console.error('❌ Search failed:', err);
        } else {
          console.log(`✅ Search successful - found ${results ? results.length : 0} unseen messages`);
        }
        
        console.log('\n🎉 All tests passed! IMAP connection is working properly.');
        imap.end();
      });
    }
  });
});

imap.once('error', function(err) {
  const connectTime = Date.now() - testStartTime;
  console.error(`❌ IMAP Connection failed after ${connectTime}ms:`, err);
  
  if (err.source === 'timeout') {
    console.error('\n💡 This appears to be a timeout issue. Possible causes:');
    console.error('  - Firewall blocking IMAP connections');
    console.error('  - Network connectivity issues');
    console.error('  - Gmail IMAP servers temporarily unavailable');
    console.error('  - Incorrect IMAP settings');
  } else if (err.source === 'timeout-auth') {
    console.error('\n💡 Authentication timeout. Possible causes:');
    console.error('  - Incorrect username/password');
    console.error('  - Gmail app-specific password needed');
    console.error('  - 2FA not properly configured');
  }
  
  console.error('\n🔧 Troubleshooting steps:');
  console.error('  1. Check your internet connection');
  console.error('  2. Verify IMAP settings in Gmail are enabled');
  console.error('  3. Ensure you\'re using an app-specific password if 2FA is enabled');
  console.error('  4. Try connecting from a different network');
  
  process.exit(1);
});

imap.once('end', function() {
  console.log('📧 IMAP connection ended');
  if (connectionSuccessful) {
    console.log('✅ Test completed successfully');
    process.exit(0);
  }
});

console.log('\n⏳ Connecting to IMAP server...');
console.log('This may take up to 60 seconds...\n');

imap.connect();

// Set a maximum test timeout
setTimeout(() => {
  if (!connectionSuccessful) {
    console.error('❌ Test timed out after 90 seconds');
    console.error('This suggests a network connectivity issue or IMAP server problems');
    process.exit(1);
  }
}, 90000); 