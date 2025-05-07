require('dotenv').config();
const { Pool } = require('pg');

async function checkPOOnly() {
  try {
    // Connect to database
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    
    // Get purchase order status only
    const result = await pool.query(`
      SELECT po_id, po_number, status, approval_status, approved_by, approval_date
      FROM purchase_orders
      WHERE po_id = 181
    `);
    
    if (result.rows.length === 0) {
      console.log('Purchase order not found');
      return;
    }
    
    const po = result.rows[0];
    console.log('Purchase Order Status Information:');
    console.log('--------------------------------');
    console.log(`PO #${po.po_number} (ID: ${po.po_id})`);
    console.log(`Status: ${po.status}`);
    console.log(`Approval Status: ${po.approval_status || 'NULL'}`);
    console.log(`Approved by: ${po.approved_by || 'none'}`);
    console.log(`Approval Date: ${po.approval_date || 'none'}`);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPOOnly().catch(console.error); 