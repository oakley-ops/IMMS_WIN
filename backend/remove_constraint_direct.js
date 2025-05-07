// Script to remove the unique constraint on fiserv_part_number
const { pool } = require('./db');

async function removeConstraint() {
  let client = null;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    
    console.log('Removing unique constraint from fiserv_part_number...');
    
    // First, try to drop the constraint directly
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
    
    // Verify the constraint is gone
    const verifyQuery = `
      SELECT con.conname
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      INNER JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE rel.relname = 'parts'
      AND att.attname = 'fiserv_part_number'
      AND con.contype = 'u';
    `;
    
    const verifyResult = await client.query(verifyQuery);
    
    if (verifyResult.rows.length === 0) {
      console.log('Verification successful: No unique constraint found on fiserv_part_number column.');
    } else {
      console.log('Warning: Unique constraint still exists:', verifyResult.rows[0].conname);
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error removing constraint:', error);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

// Run the function
removeConstraint(); 