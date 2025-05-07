const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'fiservinventory',
  password: '1234',
  ssl: false
});

async function fixEmailTracking() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Get the PO ID for 202503-0001
    console.log('Getting PO ID...');
    const poResult = await client.query(`
      SELECT po_id, po_number, status, approval_status
      FROM purchase_orders
      WHERE po_number = '202503-0001'
    `);

    if (poResult.rows.length === 0) {
      throw new Error('Purchase order not found');
    }

    const po = poResult.rows[0];
    console.log('\nFound PO:', po);

    // 2. Update the PO status
    console.log('\nUpdating PO status...');
    const updateResult = await client.query(`
      UPDATE purchase_orders
      SET status = 'approved',
          approval_status = 'approved',
          approval_date = NOW(),
          approved_by = 'isaac.rodriguez@fiserv.com',
          notes = 'Fixed via tracking fix script'
      WHERE po_id = $1
      RETURNING po_id, po_number, status, approval_status
    `, [po.po_id]);

    console.log('\nUpdated PO:', updateResult.rows[0]);

    // 3. Update all tracking records for this PO
    console.log('\nUpdating tracking records...');
    const trackingUpdateResult = await client.query(`
      UPDATE po_email_tracking
      SET status = 'approved',
          approval_date = NOW(),
          approval_email = 'isaac.rodriguez@fiserv.com',
          notes = 'Fixed via tracking fix script'
      WHERE po_id = $1
      RETURNING tracking_id, tracking_code, status
    `, [po.po_id]);

    console.log('\nUpdated tracking records:', trackingUpdateResult.rows);

    // 4. Verify final state
    console.log('\nVerifying final state...');
    const verifyResult = await client.query(`
      SELECT 
        p.po_id,
        p.po_number,
        p.status as po_status,
        p.approval_status,
        p.approved_by,
        COUNT(t.tracking_id) as tracking_count,
        COUNT(CASE WHEN t.status = 'approved' THEN 1 END) as approved_count
      FROM purchase_orders p
      LEFT JOIN po_email_tracking t ON p.po_id = t.po_id
      WHERE p.po_id = $1
      GROUP BY p.po_id, p.po_number, p.status, p.approval_status, p.approved_by
    `, [po.po_id]);

    console.log('\nFinal state:', verifyResult.rows[0]);

    // Commit transaction
    await client.query('COMMIT');
    console.log('\nTransaction committed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixEmailTracking().catch(console.error); 