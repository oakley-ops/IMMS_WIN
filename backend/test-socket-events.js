const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001/api/v1/email';
const TEST_PO_ID = 4; // Change this to your TEST PO ID

async function testSocketEvents() {
  console.log('=== Socket Event Test ===\n');
  
  try {
    // Test 1: Get current PO status
    console.log(`1. Getting current status for PO #${TEST_PO_ID}...`);
    const statusResponse = await axios.get(`${BASE_URL}/po-status/${TEST_PO_ID}`);
    
    if (statusResponse.data.success) {
      const po = statusResponse.data.data;
      console.log('Current PO Status:');
      console.log(`  - PO Number: ${po.po_number}`);
      console.log(`  - Status: ${po.status}`);
      console.log(`  - Approval Status: ${po.approval_status}`);
      console.log(`  - Approved By: ${po.approved_by || 'Not approved yet'}`);
      console.log(`  - Updated: ${po.updated_at}`);
    } else {
      console.error('❌ Failed to get PO status');
      return;
    }
    
    // Test 2: Force refresh to trigger socket events
    console.log(`\n2. Forcing refresh for PO #${TEST_PO_ID} to trigger socket events...`);
    const refreshResponse = await axios.post(`${BASE_URL}/refresh-po/${TEST_PO_ID}`);
    
    if (refreshResponse.data.success) {
      console.log('✅ Socket events triggered successfully');
      console.log('Check your frontend console for these events:');
      console.log('  - purchase_order_update');
      console.log('  - po_status_changed');
    } else {
      console.error('❌ Failed to trigger socket events');
    }
    
    // Test 3: Check if email monitoring is working
    console.log('\n3. Checking email monitor status...');
    const monitorResponse = await axios.get(`${BASE_URL}/monitor-status`);
    
    if (monitorResponse.data.success) {
      const status = monitorResponse.data.status;
      console.log(`Email Monitor Running: ${status.emailMonitorProcess.running}`);
      console.log(`IMAP Configured: ${status.imapConfiguration.configured}`);
      
      if (!status.emailMonitorProcess.running) {
        console.log('⚠️  Email monitor not running - socket events from email approvals won\'t work');
      }
    }
    
    console.log('\n=== Frontend Debugging Guide ===');
    console.log('\n🔍 To debug the frontend socket connection:');
    console.log('\n1. Open browser developer console');
    console.log('2. Check if you see socket connection messages');
    console.log('3. Look for these events when PO status changes:');
    console.log('   - purchase_order_update');
    console.log('   - po_status_changed');
    console.log('   - po_status_update');
    
    console.log('\n4. Frontend should be listening like this:');
    console.log(`
// Example frontend socket listener
socket.on('purchase_order_update', (data) => {
  console.log('PO Updated:', data);
  // Update your state/UI here
  updatePurchaseOrderInState(data);
});

socket.on('po_status_changed', (data) => {
  console.log('PO Status Changed:', data);
  // Refresh the specific PO or entire list
  refreshPurchaseOrdersList();
});
    `);
    
    console.log('\n5. If frontend is not receiving events:');
    console.log('   - Check socket connection in network tab');
    console.log('   - Verify socket.io client is properly connected');
    console.log('   - Check for JavaScript errors in console');
    console.log('   - Try manually refreshing the page');
    
    console.log('\n📝 Quick Fix Options:');
    console.log('1. Manual refresh: Reload the dashboard page');
    console.log('2. API polling: Have frontend periodically check PO status');
    console.log('3. Force refresh button in UI');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testSocketEvents().catch(console.error); 