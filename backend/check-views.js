const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkViews() {
  const client = await pool.connect();
  
  try {
    console.log('Checking if views exist...');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Views in the database:');
    result.rows.forEach(row => {
      console.log(row.table_name);
    });
    
    // Check machine_parts_cost_view
    console.log('\nTesting machine_parts_cost_view...');
    try {
      const costViewResult = await client.query('SELECT * FROM machine_parts_cost_view LIMIT 5');
      console.log(`Found ${costViewResult.rows.length} rows in machine_parts_cost_view`);
      if (costViewResult.rows.length > 0) {
        console.log('Sample row:', costViewResult.rows[0]);
      }
    } catch (error) {
      console.error('Error querying machine_parts_cost_view:', error.message);
    }
    
    // Check machine_parts_detail_view
    console.log('\nTesting machine_parts_detail_view...');
    try {
      const detailViewResult = await client.query('SELECT * FROM machine_parts_detail_view LIMIT 5');
      console.log(`Found ${detailViewResult.rows.length} rows in machine_parts_detail_view`);
      if (detailViewResult.rows.length > 0) {
        console.log('Sample row:', detailViewResult.rows[0]);
      }
    } catch (error) {
      console.error('Error querying machine_parts_detail_view:', error.message);
    }
    
  } catch (error) {
    console.error('Error checking views:', error);
  } finally {
    client.release();
  }
}

// Run the check
checkViews()
  .then(() => {
    console.log('\nCheck completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  }); 