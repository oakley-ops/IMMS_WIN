// Read-only: lists purchase_orders columns and flags any the metadata
// refactor depends on that are missing. Safe to run anytime.
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'purchase_orders' ORDER BY column_name`
    );
    const have = new Set(rows.map((r) => r.column_name));
    console.log('purchase_orders columns present:');
    console.log(rows.map((r) => '  ' + r.column_name).join('\n'));

    const need = [
      'supplier_id', 'approval_status', 'is_urgent', 'next_day_air', 'priority',
      'shipping_cost', 'tax_amount', 'requested_by', 'approved_by', 'manual_supplier_name',
    ];
    const missing = need.filter((c) => !have.has(c));
    console.log('\nMISSING columns the new code needs:', missing.length ? missing.join(', ') : '(none)');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
