const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTableStructure() {
  const client = await pool.connect();
  
  try {
    console.log('Checking transactions table structure...');
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position
    `);
    
    console.log('transactions table columns:');
    result.rows.forEach(row => {
      console.log(`${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('Error checking table structure:', error);
  } finally {
    client.release();
  }
}

// Run the check
checkTableStructure()
  .then(() => {
    console.log('Check completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  }); 