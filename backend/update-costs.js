/**
 * Utility script to update costs in the database
 * This ensures all parts have a valid unit_cost value
 */

const { Pool } = require('pg');
require('dotenv').config();

async function updateCosts() {
  console.log('🔄 UPDATING PART COSTS');
  console.log('====================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. Check how many parts have null or zero costs
    console.log('\n1. Checking current cost data:');
    const checkResult = await pool.query(`
      SELECT COUNT(*) as total_parts,
             COUNT(*) FILTER (WHERE unit_cost IS NULL OR unit_cost = 0 OR unit_cost = '0') as zero_costs
      FROM parts;
    `);
    
    const { total_parts, zero_costs } = checkResult.rows[0];
    console.log(`- Total parts: ${total_parts}`);
    console.log(`- Parts with zero/null costs: ${zero_costs}`);
    console.log(`- Percentage: ${(zero_costs / total_parts * 100).toFixed(2)}%`);

    // 2. Update parts with null/zero costs to have random costs
    if (zero_costs > 0) {
      console.log('\n2. Updating parts with zero/null costs:');
      
      // Generate random costs between $5 and $100
      const updateResult = await pool.query(`
        UPDATE parts
        SET unit_cost = (RANDOM() * 95 + 5)::numeric(10,2)
        WHERE unit_cost IS NULL OR unit_cost = 0 OR unit_cost = '0'
        RETURNING part_id, name, unit_cost;
      `);
      
      console.log(`✅ Updated ${updateResult.rows.length} parts with random costs`);
      
      // Show sample of updated parts
      console.log('\nSample of updated parts:');
      updateResult.rows.slice(0, 5).forEach((part, i) => {
        console.log(`${i+1}. ${part.name}: $${part.unit_cost}`);
      });
    } else {
      console.log('✅ No parts need cost updates');
    }

    // 3. Verify all parts now have costs
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE unit_cost IS NULL OR unit_cost = 0 OR unit_cost = '0') as zero_costs
      FROM parts;
    `);
    
    console.log('\n3. Verification after updates:');
    console.log(`- Parts with zero/null costs: ${verifyResult.rows[0].zero_costs}`);
    
    // 4. Show sample of current costs
    const sampleResult = await pool.query(`
      SELECT part_id, name, unit_cost
      FROM parts
      ORDER BY RANDOM()
      LIMIT 10;
    `);
    
    console.log('\n4. Sample of current costs:');
    sampleResult.rows.forEach((part, i) => {
      console.log(`${i+1}. ${part.name}: $${part.unit_cost}`);
    });

  } catch (error) {
    console.error('Error updating costs:', error);
  } finally {
    await pool.end();
    console.log('\nDone!');
  }
}

updateCosts().catch(console.error); 