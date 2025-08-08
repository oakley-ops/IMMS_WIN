const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('Running PM system migrations...');
    
    // Read and run the PM system tables migration
    const pmSqlPath = path.join(__dirname, 'migrations', 'create_pm_system_tables.sql');
    const pmSql = fs.readFileSync(pmSqlPath, 'utf8');
    await pool.query(pmSql);
    console.log('✓ PM system tables created');
    
    // Read and run the machine type migration
    const machineTypeSqlPath = path.join(__dirname, 'migrations', 'add_machine_type_to_machines.sql');
    const machineTypeSql = fs.readFileSync(machineTypeSqlPath, 'utf8');
    await pool.query(machineTypeSql);
    console.log('✓ Machine type column added');
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations(); 