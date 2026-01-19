/**
 * Setup script for Project Management tables
 * Run this script to create all necessary tables for the project management system
 * 
 * Usage: node setup-project-tables.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupProjectTables() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Project Management tables setup...\n');
    
    await client.query('BEGIN');

    // Check if tables already exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'projects', 
        'equipment_installations', 
        'project_milestones', 
        'project_tasks', 
        'project_risks', 
        'project_documents', 
        'project_notes', 
        'equipment_dependencies'
      )
    `);

    const existingTables = tablesCheck.rows.map(row => row.table_name);
    console.log('📋 Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'None');

    // 1. Create projects table
    if (!existingTables.includes('projects')) {
      console.log('\n✨ Creating projects table...');
      await client.query(`
        CREATE TABLE projects (
          project_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          start_date DATE NOT NULL,
          end_date DATE,
          status VARCHAR(50) CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')) DEFAULT 'planning',
          budget DECIMAL(12, 2),
          facility_id INTEGER,
          project_manager VARCHAR(255),
          priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Projects table created');
    } else {
      console.log('\n⏭️  Projects table already exists');
    }

    // 2. Create equipment_installations table
    if (!existingTables.includes('equipment_installations')) {
      console.log('\n✨ Creating equipment_installations table...');
      await client.query(`
        CREATE TABLE equipment_installations (
          installation_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          equipment_name VARCHAR(255) NOT NULL,
          equipment_type VARCHAR(255),
          manufacturer VARCHAR(255),
          model VARCHAR(255),
          serial_number VARCHAR(100),
          planned_installation_date DATE,
          actual_installation_date DATE,
          status VARCHAR(50) CHECK (status IN ('pending', 'ordered', 'delivered', 'installed', 'tested', 'operational', 'delayed')) DEFAULT 'pending',
          location_in_facility VARCHAR(255),
          installation_notes TEXT,
          dependencies TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Equipment installations table created');
    } else {
      console.log('\n⏭️  Equipment installations table already exists');
    }

    // 3. Create project_milestones table
    if (!existingTables.includes('project_milestones')) {
      console.log('\n✨ Creating project_milestones table...');
      await client.query(`
        CREATE TABLE project_milestones (
          milestone_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          due_date DATE,
          completion_date DATE,
          status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Project milestones table created');
    } else {
      console.log('\n⏭️  Project milestones table already exists');
    }

    // 4. Create project_tasks table
    if (!existingTables.includes('project_tasks')) {
      console.log('\n✨ Creating project_tasks table...');
      await client.query(`
        CREATE TABLE project_tasks (
          task_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          milestone_id INTEGER REFERENCES project_milestones(milestone_id) ON DELETE SET NULL,
          installation_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE SET NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          assignee VARCHAR(255),
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'delayed')) DEFAULT 'not_started',
          priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Project tasks table created');
    } else {
      console.log('\n⏭️  Project tasks table already exists');
    }

    // 5. Create project_risks table
    if (!existingTables.includes('project_risks')) {
      console.log('\n✨ Creating project_risks table...');
      await client.query(`
        CREATE TABLE project_risks (
          risk_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          impact VARCHAR(50) CHECK (impact IN ('low', 'medium', 'high', 'critical')),
          probability VARCHAR(50) CHECK (probability IN ('low', 'medium', 'high', 'certain')),
          status VARCHAR(50) CHECK (status IN ('identified', 'monitoring', 'mitigated', 'occurred', 'closed')) DEFAULT 'identified',
          mitigation_plan TEXT,
          contingency_plan TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Project risks table created');
    } else {
      console.log('\n⏭️  Project risks table already exists');
    }

    // 6. Create project_documents table
    if (!existingTables.includes('project_documents')) {
      console.log('\n✨ Creating project_documents table...');
      await client.query(`
        CREATE TABLE project_documents (
          document_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          file_path VARCHAR(512),
          document_type VARCHAR(100),
          upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          uploader VARCHAR(255),
          description TEXT
        )
      `);
      console.log('✅ Project documents table created');
    } else {
      console.log('\n⏭️  Project documents table already exists');
    }

    // 7. Create project_notes table
    if (!existingTables.includes('project_notes')) {
      console.log('\n✨ Creating project_notes table...');
      await client.query(`
        CREATE TABLE project_notes (
          note_id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
          author VARCHAR(255),
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Project notes table created');
    } else {
      console.log('\n⏭️  Project notes table already exists');
    }

    // 8. Create equipment_dependencies table
    if (!existingTables.includes('equipment_dependencies')) {
      console.log('\n✨ Creating equipment_dependencies table...');
      await client.query(`
        CREATE TABLE equipment_dependencies (
          dependency_id SERIAL PRIMARY KEY,
          equipment_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
          depends_on_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
          dependency_type VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Equipment dependencies table created');
    } else {
      console.log('\n⏭️  Equipment dependencies table already exists');
    }

    await client.query('COMMIT');
    
    console.log('\n🎉 Project Management tables setup completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - Projects table: ✓');
    console.log('   - Equipment installations table: ✓');
    console.log('   - Project milestones table: ✓');
    console.log('   - Project tasks table: ✓');
    console.log('   - Project risks table: ✓');
    console.log('   - Project documents table: ✓');
    console.log('   - Project notes table: ✓');
    console.log('   - Equipment dependencies table: ✓');
    console.log('\n✅ Your project management system is ready to use!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error setting up project tables:', error);
    console.error('Details:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupProjectTables()
  .then(() => {
    console.log('\n👋 Setup script completed. You can now use the project management system.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup script failed:', error.message);
    process.exit(1);
  });







