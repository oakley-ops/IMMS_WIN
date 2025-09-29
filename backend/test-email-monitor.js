const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001/api/v1/email';

async function testEmailMonitor() {
  console.log('=== Email Monitor Test Suite ===\n');
  
  try {
    // Test 1: Check monitor status
    console.log('1. Checking email monitor status...');
    const statusResponse = await axios.get(`${BASE_URL}/monitor-status`);
    console.log('Status Response:', JSON.stringify(statusResponse.data, null, 2));
    
    if (statusResponse.data.success) {
      const status = statusResponse.data.status;
      
      console.log('\n--- Monitor Status Summary ---');
      console.log(`IMAP Configured: ${status.imapConfiguration.configured}`);
      console.log(`Email Monitor Running: ${status.emailMonitorProcess.running}`);
      console.log(`Tracking Service: ${status.trackingService.status}`);
      
      if (status.emailMonitorProcess.running) {
        console.log(`Monitor PID: ${status.emailMonitorProcess.pid}`);
      }
      
      if (!status.imapConfiguration.configured) {
        console.log('\n⚠️  IMAP not configured. Email monitoring will not work.');
        return;
      }
      
      if (!status.emailMonitorProcess.running) {
        console.log('\n⚠️  Email monitor not running. Attempting to restart...');
        
        // Test 2: Restart monitor
        console.log('\n2. Restarting email monitor...');
        const restartResponse = await axios.post(`${BASE_URL}/restart-monitor`);
        console.log('Restart Response:', JSON.stringify(restartResponse.data, null, 2));
        
        if (restartResponse.data.success) {
          console.log('✅ Email monitor restarted successfully');
          
          // Wait a moment and check status again
          console.log('\n3. Checking status after restart...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newStatusResponse = await axios.get(`${BASE_URL}/monitor-status`);
          const newStatus = newStatusResponse.data.status;
          
          console.log(`Email Monitor Running After Restart: ${newStatus.emailMonitorProcess.running}`);
          
          if (newStatus.emailMonitorProcess.running) {
            console.log(`New Monitor PID: ${newStatus.emailMonitorProcess.pid}`);
          }
        } else {
          console.log('❌ Failed to restart email monitor');
        }
      } else {
        console.log('✅ Email monitor is running');
      }
      
    } else {
      console.log('❌ Failed to get monitor status');
    }
    
    // Test 3: Test approval processing (if you have a tracking code)
    console.log('\n4. Testing approval processing...');
    console.log('To test approval processing, you need a tracking code from a sent email.');
    console.log('Example usage:');
    console.log(`
curl -X POST ${BASE_URL}/debug-approval \\
  -H "Content-Type: application/json" \\
  -d '{
    "trackingCode": "YOUR_TRACKING_CODE_HERE",
    "approvalEmail": "admin@company.com",
    "emailBody": "approved"
  }'
    `);
    
    console.log('\n=== Test Complete ===');
    console.log('\n🔍 What to do next:');
    console.log('1. If email monitor is running: Send a test PO approval email');
    console.log('2. Have Isaac reply with "approved"');
    console.log('3. Check the application logs for processing messages');
    console.log('4. If still not working, check the application startup logs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testEmailMonitor().catch(console.error); 