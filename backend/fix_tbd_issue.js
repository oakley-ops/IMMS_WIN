// Comprehensive script to fix the TBD issue
const { pool } = require('./db');

async function fixTBDIssue() {
  let client = null;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    
    // Step 1: Remove the unique constraint
    console.log('\n--- STEP 1: Removing unique constraint ---');
    
    try {
      await client.query('ALTER TABLE parts DROP CONSTRAINT IF EXISTS unique_fiserv_part_number;');
      console.log('Successfully dropped constraint by name.');
    } catch (err) {
      console.log('Could not drop constraint by name, trying alternative approach:', err.message);
      
      // If that fails, try to find the constraint name from the system catalog
      const constraintQuery = `
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        INNER JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'parts'
        AND att.attname = 'fiserv_part_number'
        AND con.contype = 'u';
      `;
      
      const result = await client.query(constraintQuery);
      
      if (result.rows.length > 0) {
        const constraintName = result.rows[0].conname;
        console.log(`Found constraint name: ${constraintName}`);
        
        // Drop the constraint using the found name
        await client.query(`ALTER TABLE parts DROP CONSTRAINT IF EXISTS "${constraintName}";`);
        console.log(`Successfully dropped constraint: ${constraintName}`);
      } else {
        console.log('No unique constraint found on fiserv_part_number column.');
      }
    }
    
    // Step 2: Update existing TBD values
    console.log('\n--- STEP 2: Updating existing TBD values ---');
    
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
    
    // Step 3: Create a partial unique index that excludes TBD pattern
    console.log('\n--- STEP 3: Creating partial unique index ---');
    
    try {
      // Drop any existing index first
      await client.query('DROP INDEX IF EXISTS idx_unique_fiserv_part_number;');
      
      // Create a partial unique index that excludes TBD pattern
      await client.query(`
        CREATE UNIQUE INDEX idx_unique_fiserv_part_number 
        ON parts (fiserv_part_number) 
        WHERE fiserv_part_number NOT LIKE 'TBD-%';
      `);
      
      console.log('Successfully created partial unique index that allows TBD- values.');
    } catch (err) {
      console.error('Error creating partial unique index:', err);
    }
    
    console.log('\nAll steps completed successfully!');
    
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error during rollback:', rollbackErr);
      }
    }
    console.error('Error fixing TBD issue:', error);
  } finally {
    if (client) {
      client.release();
    }
    console.log('Done!');
    process.exit(0);
  }
}

// Run the function
fixTBDIssue(); 