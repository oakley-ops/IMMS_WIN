const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fiservinventory',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const migrationFiles = [
  '001_create_dies_table.sql',
  '002_create_die_change_history_table.sql',
  '003_create_die_sharpening_records_table.sql',
  '004_create_die_documents_table.sql',
  '005_create_die_maintenance_schedule_table.sql',
  '006_alter_machines_add_die_fields.sql',
  '007_create_die_triggers.sql',
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Die Tracker database migrations...\n');
    
    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, 'migrations', file);
      console.log(`Running migration: ${file}`);
      
      try {
        const sql = await fs.readFile(filePath, 'utf8');
        await client.query(sql);
        console.log(`✓ ${file} completed successfully`);
      } catch (error) {
        console.error(`✗ Error in ${file}:`, error.message);
        throw error;
      }
    }
    
    console.log('\n✓ All Die Tracker migrations completed successfully!');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'die%'
      ORDER BY table_name
    `);
    
    console.log('\nDie Tracker tables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
