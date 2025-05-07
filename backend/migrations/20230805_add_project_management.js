const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createProjectManagementTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating project management tables...');

    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(50) CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
        budget DECIMAL(12, 2),
        facility_id INTEGER,
        project_manager VARCHAR(255),
        priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create equipment_installations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_installations (
        installation_id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
        equipment_name VARCHAR(255) NOT NULL,
        equipment_type VARCHAR(255),
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        serial_number VARCHAR(100),
        planned_installation_date DATE,
        actual_installation_date DATE,
        status VARCHAR(50) CHECK (status IN ('pending', 'ordered', 'delivered', 'installed', 'tested', 'operational', 'delayed')),
        location_in_facility VARCHAR(255),
        installation_notes TEXT,
        dependencies TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create project_milestones table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        milestone_id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE,
        completion_date DATE,
        status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create project_tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        task_id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
        milestone_id INTEGER REFERENCES project_milestones(milestone_id) ON DELETE SET NULL,
        installation_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        assignee VARCHAR(255),
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'delayed')),
        priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create project_risks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_risks (
        risk_id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        impact VARCHAR(50) CHECK (impact IN ('low', 'medium', 'high', 'critical')),
        probability VARCHAR(50) CHECK (probability IN ('low', 'medium', 'high', 'certain')),
        status VARCHAR(50) CHECK (status IN ('identified', 'monitoring', 'mitigated', 'occurred', 'closed')),
        mitigation_plan TEXT,
        contingency_plan TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create project_documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_documents (
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

    // Create project_notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_notes (
        note_id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
        author VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create equipment_dependencies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_dependencies (
        dependency_id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
        depends_on_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
        dependency_type VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if permissions table exists
    const permissionsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_permissions'
      )
    `);

    if (permissionsTableCheck.rows[0].exists) {
      console.log('Permissions table exists, adding project management permission...');
      
      // Add project management permission to permissions table
      await client.query(`
        INSERT INTO user_permissions (permission_name, description)
        VALUES ('CAN_MANAGE_PROJECTS', 'Can create, view, update and delete projects and equipment installations')
        ON CONFLICT (permission_name) DO NOTHING
      `);

      // Check if roles table exists
      const rolesTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_roles'
        )
      `);

      if (rolesTableCheck.rows[0].exists) {
        console.log('Roles table exists, adding permission to admin role...');
        
        // Add permission to admin role
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT r.role_id, p.permission_id 
          FROM user_roles r, user_permissions p
          WHERE r.role_name = 'admin' AND p.permission_name = 'CAN_MANAGE_PROJECTS'
          ON CONFLICT DO NOTHING
        `);
      } else {
        console.log('Roles table does not exist, skipping role permission assignment.');
      }
    } else {
      console.log('Permissions table does not exist, skipping permission setup.');
    }

    await client.query('COMMIT');
    console.log('Project management tables created successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating project management tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the migration
createProjectManagementTables()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 