// check-notes.js
const { Pool } = require('pg');

async function checkEmailTrackingNotes() {
  console.log('Checking email tracking records for notes...');
  
  // Connect to database using hardcoded credentials from .env
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'fiservinventory',
    password: '1234',
    ssl: false
  });

  try {
    // Get the 5 most recent email tracking records
    const result = await pool.query(
      `SELECT tracking_id, po_id, recipient_email, notes, status, sent_date 
       FROM po_email_tracking 
       ORDER BY sent_date DESC
       LIMIT 5`
    );
    
    console.log('Database connection successful');
    console.log('Recent email tracking records:', result.rows);
    
    if (result.rows.length === 0) {
      console.log('No email tracking records found');
    } else {
      // Check if any records have notes
      const recordsWithNotes = result.rows.filter(record => record.notes);
      console.log(`Records with notes: ${recordsWithNotes.length} of ${result.rows.length}`);
      
      if (recordsWithNotes.length > 0) {
        console.log('Sample notes:', recordsWithNotes[0].notes);
      } else {
        console.log('No records have notes saved');
      }
    }
  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run the function
checkEmailTrackingNotes(); 