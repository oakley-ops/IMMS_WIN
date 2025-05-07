const { pool } = require('./db');

async function removeConstraint() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      console.log('Removing unique constraint from fiserv_part_number...');
      await client.query('ALTER TABLE parts DROP CONSTRAINT IF EXISTS unique_fiserv_part_number;');
      console.log('Constraint removed successfully!');
    } finally {
      client.release();
    }
    
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error removing constraint:', error);
    process.exit(1);
  }
}

removeConstraint(); 