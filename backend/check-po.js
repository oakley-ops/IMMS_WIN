const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'fiservinventory',
  password: '1234',
  ssl: false
});

async function checkPO() {
  try {
    const result = await pool.query(`
      SELECT po_id, po_number, status, approval_status, approved_by
      FROM purchase_orders 
      ORDER BY po_id DESC
      LIMIT 10
    `);

    if (result.rows.length > 0) {
      console.log('Recent Purchase Orders:');
      result.rows.forEach(row => {
        console.log('\nPO Details:');
        console.log('ID:', row.po_id);
        console.log('Number:', row.po_number);
        console.log('Status:', row.status);
        console.log('Approval Status:', row.approval_status);
        console.log('Approved By:', row.approved_by);
      });
    } else {
      console.log('No purchase orders found in the database');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkPO(); 