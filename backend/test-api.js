require('dotenv').config();
const axios = require('axios');

async function testPartsAPI() {
  try {
    console.log('Testing parts API...');
    
    // Login to get a token
    console.log('Logging in to get JWT token...');
    const loginResponse = await axios.post('http://localhost:4000/api/v1/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Successfully obtained token');
    
    const response = await axios.get('http://localhost:4000/api/v1/parts?page=0&limit=25', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.items) {
      console.log(`Successfully received ${response.data.items.length} parts from API`);
      console.log('First part data:', JSON.stringify(response.data.items[0], null, 2));
      
      // Check unit_cost and cost fields
      const partsWithCost = response.data.items.filter(part => 
        part.unit_cost !== null && part.unit_cost !== undefined || 
        part.cost !== null && part.cost !== undefined
      );
      
      console.log(`\nParts with cost information: ${partsWithCost.length}/${response.data.items.length}`);
      
      if (partsWithCost.length > 0) {
        console.log('Sample part with cost:');
        console.log(JSON.stringify(partsWithCost[0], null, 2));
      } else {
        console.log('No parts with cost information found');
      }
      
      // Check location fields
      const partsWithLocation = response.data.items.filter(part => 
        part.location !== null && part.location !== undefined && part.location !== ''
      );
      
      console.log(`\nParts with location information: ${partsWithLocation.length}/${response.data.items.length}`);
      
      if (partsWithLocation.length > 0) {
        console.log('Sample part with location:');
        console.log(JSON.stringify(partsWithLocation[0], null, 2));
      } else {
        console.log('No parts with location information found');
      }
      
    } else {
      console.log('No parts returned from API');
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testPartsAPI(); 