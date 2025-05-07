// Script to update existing TBD values to unique values
const { pool } = require('./db');

async function updateTBDValues() {
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
    for (let i = 0; i < result.rows.length; i++) {
      const part = result.rows[i];
      // Use index to ensure uniqueness even if executed quickly
      const uniqueTBD = `TBD-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`;
      console.log(`Updating part ${part.part_id} from "${part.fiserv_part_number}" to "${uniqueTBD}"`);
      
      await client.query(
        'UPDATE parts SET fiserv_part_number = $1 WHERE part_id = $2',
        [uniqueTBD, part.part_id]
      );
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Successfully updated all TBD values!');
    
    // Verify no TBD values remain
    const verifyResult = await client.query(
      "SELECT COUNT(*) FROM parts WHERE fiserv_part_number = 'TBD'"
    );
    
    const remainingTBD = parseInt(verifyResult.rows[0].count);
    if (remainingTBD === 0) {
      console.log('Verification successful: No plain TBD values remain in the database.');
    } else {
      console.log(`Warning: ${remainingTBD} parts still have 'TBD' as fiserv_part_number.`);
    }
    
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error updating TBD values:', error);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

// Run the function
updateTBDValues(); 