const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabaseCosts() {
  console.log('CHECKING DATABASE COST VALUES');
  console.log('============================');

  // Create connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check database schema for unit_cost column
    console.log('\n1. Checking database schema:');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parts' 
      ORDER BY column_name;
    `);
    
    console.log('Parts table columns:');
    schemaResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check if unit_cost column exists
    const unitCostColumn = schemaResult.rows.find(row => row.column_name === 'unit_cost');
    if (!unitCostColumn) {
      console.log('⚠️ unit_cost column does not exist in the parts table!');
    } else {
      console.log(`✓ unit_cost column exists (type: ${unitCostColumn.data_type})`);
    }

    // Get sample cost data
    console.log('\n2. Sample cost data (first 10 parts):');
    const costResult = await pool.query(`
      SELECT part_id, name, unit_cost
      FROM parts
      ORDER BY part_id DESC
      LIMIT 10;
    `);
    
    console.log('│ ID │ Name │ unit_cost │');
    console.log('│----│------│-----------│');
    costResult.rows.forEach(row => {
      console.log(`│ ${row.part_id} │ ${row.name.substring(0, 20).padEnd(20, ' ')} │ ${row.unit_cost || 'NULL'} │`);
    });

    // Check for zero or null values
    const zeroOrNullCosts = costResult.rows.filter(row => 
      row.unit_cost === null || 
      row.unit_cost === 0 || 
      row.unit_cost === '0' ||
      row.unit_cost === '0.00'
    );
    
    console.log(`\n${zeroOrNullCosts.length}/${costResult.rows.length} parts have zero/null unit_cost values`);

    // Check data types
    console.log('\n3. Data type analysis:');
    costResult.rows.forEach((row, i) => {
      console.log(`Part #${i+1}: ${row.name}`);
      console.log(`   - unit_cost: ${row.unit_cost} (${typeof row.unit_cost})`);
      
      // If it's a string, try parsing
      if (typeof row.unit_cost === 'string') {
        const parsed = parseFloat(row.unit_cost);
        console.log(`   - Parsed unit_cost: ${parsed} (${typeof parsed}, isNaN: ${isNaN(parsed)})`);
      }
    });

    // Run direct update check
    console.log('\n4. If you want to update all zero costs to a test value, run:');
    console.log(`   UPDATE parts SET unit_cost = '15.75' WHERE unit_cost IS NULL OR unit_cost = '0' OR unit_cost = '0.00';`);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    pool.end();
  }
}

// Run the function
checkDatabaseCosts().catch(console.error); 