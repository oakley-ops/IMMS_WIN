const { pool } = require('./db');

async function fixTBDValues() {
  let client = null;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Find all parts with fiserv_part_number = 'TBD'
    console.log('Finding parts with TBD as fiserv_part_number...');
    const result = await client.query(
      "SELECT part_id, fiserv_part_number FROM parts WHERE fiserv_part_number = 'TBD'"
    );
    
    console.log(`Found ${result.rows.length} parts with TBD as fiserv_part_number`);
    
    // Update each part with a unique TBD value
    for (const part of result.rows) {
      const uniqueTBD = `TBD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      console.log(`Updating part ${part.part_id} from "${part.fiserv_part_number}" to "${uniqueTBD}"`);
      
      await client.query(
        'UPDATE parts SET fiserv_part_number = $1 WHERE part_id = $2',
        [uniqueTBD, part.part_id]
      );
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Successfully updated all TBD values!');
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error fixing TBD values:', error);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

fixTBDValues(); 