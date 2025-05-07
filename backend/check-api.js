const axios = require('axios');

async function checkAPI() {
  try {
    console.log('DETAILED API RESPONSE CHECK');
    console.log('=========================');
    
    // Login to get token
    console.log('1. Getting authentication token...');
    const loginResponse = await axios.post('http://localhost:4000/api/v1/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('   Token received ✓');
    
    // Get parts list
    console.log('\n2. Fetching parts from the API...');
    const partsResponse = await axios.get('http://localhost:4000/api/v1/parts?page=0&limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!partsResponse.data || !partsResponse.data.items) {
      console.log('   ✗ Error: No parts data received');
      return;
    }
    
    console.log(`   ✓ Received ${partsResponse.data.items.length} parts`);
    
    // Verify structure
    console.log('\n3. API Response Structure:');
    console.log(`   - Has 'items' array: ${Array.isArray(partsResponse.data.items) ? '✓' : '✗'}`);
    console.log(`   - Has 'total' count: ${partsResponse.data.total !== undefined ? '✓' : '✗'}`);
    
    // Examine each part
    console.log('\n4. Examining individual parts:');
    partsResponse.data.items.forEach((part, index) => {
      console.log(`\n   Part ${index + 1}: ${part.name} (ID: ${part.part_id})`);
      
      // Check if unit_cost exists
      console.log(`   - Has unit_cost field: ${part.unit_cost !== undefined ? '✓' : '✗'}`);
      if (part.unit_cost !== undefined) {
        console.log(`     Value: "${part.unit_cost}" (${typeof part.unit_cost})`);
        console.log(`     Parsed: ${Number(part.unit_cost)} (${typeof Number(part.unit_cost)})`);
        console.log(`     Is valid number: ${!isNaN(Number(part.unit_cost)) ? '✓' : '✗'}`);
      }
      
      // Check if cost exists
      console.log(`   - Has cost field: ${part.cost !== undefined ? '✓' : '✗'}`);
      if (part.cost !== undefined) {
        console.log(`     Value: "${part.cost}" (${typeof part.cost})`);
        console.log(`     Parsed: ${Number(part.cost)} (${typeof Number(part.cost)})`);
        console.log(`     Is valid number: ${!isNaN(Number(part.cost)) ? '✓' : '✗'}`);
      }
      
      // Check all keys
      console.log(`   - All fields: ${Object.keys(part).join(', ')}`);
    });
    
    // Compare with direct database values
    console.log('\n5. Verify database values:');
    console.log('   Please run the following SQL in your database:');
    console.log(`
      SELECT part_id, name, unit_cost 
      FROM parts 
      WHERE part_id IN (${partsResponse.data.items.map(p => p.part_id).join(',')}) 
      ORDER BY part_id DESC;
    `);
    
    console.log('\n6. Frontend display calculation:');
    partsResponse.data.items.forEach((part, index) => {
      console.log(`\n   Part ${index + 1}: ${part.name}`);
      const cost = Number(part.unit_cost) || Number(part.cost) || 0;
      const display = isNaN(cost) || cost === 0 ? '-' : `$${cost.toFixed(2)}`;
      console.log(`   - Calculated cost: ${cost}`);
      console.log(`   - Displayed as: "${display}"`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

checkAPI(); 