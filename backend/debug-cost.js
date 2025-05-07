const { Pool } = require('pg');
require('dotenv').config();
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugCostField() {
  const client = await pool.connect();
  try {
    console.log('DEBUGGING COST FIELD ISSUE');
    console.log('==========================\n');
    
    // 1. Check schema for unit_cost column
    console.log('1. Checking schema for unit_cost column:');
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'parts' AND column_name = 'unit_cost'
    `);
    
    if (schemaResult.rows.length > 0) {
      console.log('Found unit_cost column in parts table:');
      console.log(schemaResult.rows[0]);
    } else {
      console.log('unit_cost column NOT found in parts table!');
    }
    
    // 2. Check data in the database
    console.log('\n2. Sample data in database:');
    const sampleData = await client.query(`
      SELECT part_id, name, unit_cost, CAST(unit_cost AS NUMERIC) as numeric_unit_cost
      FROM parts
      LIMIT 5
    `);
    
    console.log('Database sample data:');
    console.log(sampleData.rows);
    
    // 3. Manually construct a record with a non-zero cost
    console.log('\n3. Setting a sample part to have a non-zero cost:');
    const updateResult = await client.query(`
      UPDATE parts 
      SET unit_cost = 99.99 
      WHERE part_id = (SELECT part_id FROM parts LIMIT 1)
      RETURNING part_id, name, unit_cost
    `);
    
    console.log('Updated part with cost:');
    console.log(updateResult.rows[0]);
    
    // 4. Call the API and check the response
    console.log('\n4. Testing API response:');
    console.log('Logging in to get JWT token...');
    const loginResponse = await axios.post('http://localhost:4000/api/v1/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Successfully obtained token');
    
    const response = await axios.get('http://localhost:4000/api/v1/parts?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.items) {
      console.log(`Successfully received ${response.data.items.length} parts from API`);
      
      // Check unit_cost and cost fields
      console.log('\nAPI cost field analysis:');
      response.data.items.forEach((part, i) => {
        console.log(`Part ${i+1} (${part.name}):`);
        console.log(`  unit_cost: ${part.unit_cost} (${typeof part.unit_cost})`);
        console.log(`  cost: ${part.cost} (${typeof part.cost})`);
        console.log(`  calculated display: ${parseFloat(part.unit_cost) > 0 ? '$' + parseFloat(part.unit_cost).toFixed(2) : 'No display value'}`);
        console.log(`  raw properties: ${Object.keys(part).join(', ')}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error in debug script:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function debugCostIssue() {
  try {
    console.log('Debugging Cost Field Issue...');
    
    // Login to get a token
    console.log('Logging in to get JWT token...');
    const loginResponse = await axios.post('http://localhost:4000/api/v1/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Successfully obtained token');
    
    // Get parts data
    const response = await axios.get('http://localhost:4000/api/v1/parts?page=0&limit=25', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      console.log('No parts returned from API');
      return;
    }
    
    console.log(`Successfully received ${response.data.items.length} parts from API`);
    
    // Check first 5 parts in detail
    console.log('\n===== DETAILED COST FIELD ANALYSIS =====');
    for (let i = 0; i < Math.min(5, response.data.items.length); i++) {
      const part = response.data.items[i];
      console.log(`\nPart ${i+1}: ${part.name} (${part.part_id || part.id})`);
      
      // Check unit_cost field
      console.log('unit_cost:');
      console.log(`  Value: ${part.unit_cost}`);
      console.log(`  Type: ${typeof part.unit_cost}`);
      console.log(`  Numeric Value: ${Number(part.unit_cost)}`);
      console.log(`  Is Numeric: ${!isNaN(Number(part.unit_cost))}`);
      
      // Check cost field
      console.log('cost:');
      console.log(`  Value: ${part.cost}`);
      console.log(`  Type: ${typeof part.cost}`);
      console.log(`  Numeric Value: ${Number(part.cost)}`);
      console.log(`  Is Numeric: ${!isNaN(Number(part.cost))}`);
      
      // Check all fields
      console.log('All fields:');
      Object.keys(part).forEach(key => {
        console.log(`  ${key}: ${typeof part[key]}`);
      });
    }
    
    // Check database values directly
    console.log('\n===== CHECKING DATABASE VALUES =====');
    console.log('Please run the following SQL in your database:');
    console.log(`
      SELECT 
        part_id, 
        name, 
        unit_cost,
        CAST(unit_cost AS TEXT) as unit_cost_text
      FROM parts 
      ORDER BY part_id DESC
      LIMIT 5;
    `);
    
    // Frontend rendering simulation
    console.log('\n===== SIMULATING FRONTEND RENDERING =====');
    response.data.items.slice(0, 5).forEach((part, i) => {
      console.log(`\nPart ${i+1}: ${part.name}`);
      const cost = Number(part.unit_cost) || Number(part.cost) || 0;
      const displayValue = isNaN(cost) || cost === 0 ? '-' : `$${cost.toFixed(2)}`;
      console.log(`Frontend would display: ${displayValue}`);
      console.log(`Calculation detail:`);
      console.log(`- Number(part.unit_cost) = ${Number(part.unit_cost)}`);
      console.log(`- Number(part.cost) = ${Number(part.cost)}`);
      console.log(`- Final cost value = ${cost}`);
      console.log(`- isNaN(cost) = ${isNaN(cost)}`);
      console.log(`- cost === 0 = ${cost === 0}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

debugCostField().catch(console.error);
debugCostIssue(); 