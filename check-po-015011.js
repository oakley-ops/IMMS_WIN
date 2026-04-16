/**
 * Script to check the database for Purchase Order #015011
 * This will help diagnose why the PO is not showing in the UI
 */

const { Pool } = require('pg');
const path = require('path');

// Load environment variables from backend directory
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
});

async function checkPO015011() {
  try {
    console.log('🔍 Checking database for Purchase Order #015011...\n');
    
    // 1. Check if the PO exists in the purchase_orders table
    console.log('1️⃣ Searching for PO #015011 in purchase_orders table...');
    const poQuery = `
      SELECT 
        po.*,
        COALESCE(po.approval_status, po.status) as effective_status,
        s.name as supplier_name,
        v.name as vendor_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
      WHERE po.po_number = $1
    `;
    
    const poResult = await pool.query(poQuery, ['015011']);
    
    if (poResult.rows.length === 0) {
      console.log('❌ No purchase order found with PO number 015011');
      console.log('   Let\'s check for similar numbers...\n');
      
      // Check for similar PO numbers
      const similarQuery = `
        SELECT po_number, status, created_at 
        FROM purchase_orders 
        WHERE po_number LIKE '%15011%' OR po_number LIKE '015%'
        ORDER BY created_at DESC
        LIMIT 10
      `;
      const similarResult = await pool.query(similarQuery);
      
      if (similarResult.rows.length > 0) {
        console.log('📋 Similar PO numbers found:');
        similarResult.rows.forEach(row => {
          console.log(`   - ${row.po_number} (${row.status}) - ${row.created_at}`);
        });
      } else {
        console.log('   No similar PO numbers found');
      }
      
    } else {
      const po = poResult.rows[0];
      console.log('✅ Found Purchase Order #015011!');
      console.log('📊 PO Details:');
      console.log(`   - PO ID: ${po.po_id}`);
      console.log(`   - PO Number: ${po.po_number}`);
      console.log(`   - Status: ${po.status}`);
      console.log(`   - Approval Status: ${po.approval_status || 'NULL'}`);
      console.log(`   - Effective Status: ${po.effective_status}`);
      console.log(`   - Supplier: ${po.supplier_name || 'NULL'}`);
      console.log(`   - Vendor: ${po.vendor_name || 'NULL'}`);
      console.log(`   - Total Amount: $${po.total_amount || 0}`);
      console.log(`   - Created: ${po.created_at}`);
      console.log(`   - Updated: ${po.updated_at}`);
      console.log(`   - Approval Date: ${po.approval_date || 'NULL'}`);
      
      // 2. Check if it should be filtered out by the historical filter
      console.log('\n2️⃣ Checking historical filter logic...');
      const isReceivedAndOld = po.effective_status === 'received' && 
                               new Date(po.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      console.log(`   - Is status "received"? ${po.effective_status === 'received' ? 'YES' : 'NO'}`);
      console.log(`   - Is older than 7 days? ${isReceivedAndOld ? 'YES' : 'NO'}`);
      console.log(`   - Would be filtered out? ${isReceivedAndOld ? 'YES - This is why it\'s not showing!' : 'NO'}`);
      
      // 3. Check the purchase order items
      console.log('\n3️⃣ Checking purchase order items...');
      const itemsQuery = `
        SELECT 
          poi.*,
          p.name as part_name,
          p.manufacturer_part_number,
          p.internal_part_number
        FROM purchase_order_items poi
        LEFT JOIN parts p ON poi.part_id = p.part_id
        WHERE poi.po_id = $1
        ORDER BY poi.item_id
      `;
      
      const itemsResult = await pool.query(itemsQuery, [po.po_id]);
      
      if (itemsResult.rows.length === 0) {
        console.log('   ❌ No items found for this PO');
      } else {
        console.log(`   ✅ Found ${itemsResult.rows.length} items:`);
        itemsResult.rows.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.custom_part_name || item.part_name || 'Unknown Part'}`);
          console.log(`      - Part #: ${item.custom_part_number || item.manufacturer_part_number || item.internal_part_number || 'N/A'}`);
          console.log(`      - Quantity: ${item.quantity} (Received: ${item.quantity_received || 0})`);
          console.log(`      - Unit Price: $${item.unit_price || 0}`);
          console.log(`      - Total: $${item.total_price || 0}`);
          if (item.received_by) {
            console.log(`      - Received by: ${item.received_by} on ${item.received_date || 'unknown date'}`);
          }
        });
        
        // Check if all items are fully received
        const allItemsReceived = itemsResult.rows.every(item => 
          (item.quantity_received || 0) >= item.quantity
        );
        console.log(`   - All items fully received? ${allItemsReceived ? 'YES' : 'NO'}`);
      }
      
      // 4. Test the actual API query that the frontend uses
      console.log('\n4️⃣ Testing API queries...');
      
      // Query without historical filter (should show all)
      const allPOsQuery = `
        SELECT po.po_number, po.status, COALESCE(po.approval_status, po.status) as effective_status, po.created_at
        FROM purchase_orders po
        WHERE po.po_number = $1
      `;
      const allPOsResult = await pool.query(allPOsQuery, ['015011']);
      console.log(`   - Query without filter: ${allPOsResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      
      // Query with historical filter (what frontend uses by default)
      const filteredQuery = `
        SELECT po.po_number, po.status, COALESCE(po.approval_status, po.status) as effective_status, po.created_at
        FROM purchase_orders po
        WHERE po.po_number = $1
        AND NOT (COALESCE(po.approval_status, po.status) = 'received' AND po.created_at < NOW() - INTERVAL '7 days')
      `;
      const filteredResult = await pool.query(filteredQuery, ['015011']);
      console.log(`   - Query with historical filter: ${filteredResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      
      if (filteredResult.rows.length === 0 && allPOsResult.rows.length > 0) {
        console.log('   🎯 DIAGNOSIS: PO is being filtered out by the historical received orders filter!');
        console.log('   💡 SOLUTION: Check "Show historical received orders" checkbox in the UI');
      }
    }
    
    console.log('\n🔍 Database check complete!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPO015011().catch(console.error);
