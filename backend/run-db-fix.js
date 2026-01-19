// Simple script to fix the work_orders table
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixWorkOrdersTable() {
  // Create a pool using DATABASE_URL from environment
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Connecting to database...');
    
    // Read the SQL fix file
    const sqlFix = fs.readFileSync(
      path.join(__dirname, 'fix-work-orders-table.sql'),
      'utf8'
    );

    console.log('📝 Running database fix...');
    await pool.query(sqlFix);
    
    console.log('✅ SUCCESS! Work orders table has been updated!');
    console.log('');
    console.log('Changes made:');
    console.log('  - Removed machine_id foreign key constraint');
    console.log('  - Added machine_name text field');
    console.log('  - Added technician_name text field');
    console.log('  - Migrated existing data');
    console.log('');
    console.log('You can now create work orders with manual text entry! 🎉');
    
  } catch (error) {
    console.error('❌ Error fixing table:', error.message);
    console.error('');
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixWorkOrdersTable();







