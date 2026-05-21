const db = require('../db');

async function createWorkOrdersTables() {
  const client = await db.getClient();
  
  try {
    console.log('🚀 Starting Work Orders migration...');

    await client.query('BEGIN');

    // Create work_orders table
    console.log('📋 Creating work_orders table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        work_order_id SERIAL PRIMARY KEY,
        work_order_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        work_type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
        assigned_to INTEGER REFERENCES technicians(technician_id) ON DELETE SET NULL,
        created_by INTEGER,
        scheduled_date TIMESTAMP,
        due_date TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create work_order_parts table (parts used in work orders)
    console.log('🔧 Creating work_order_parts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_parts (
        wo_part_id SERIAL PRIMARY KEY,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
        part_id INTEGER NOT NULL REFERENCES parts(part_id) ON DELETE RESTRICT,
        quantity_required INTEGER NOT NULL,
        quantity_used INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create work_order_tasks table (checklist items)
    console.log('✅ Creating work_order_tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_tasks (
        task_id SERIAL PRIMARY KEY,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
        task_description TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        completed_by INTEGER REFERENCES technicians(technician_id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create work_order_comments table
    console.log('💬 Creating work_order_comments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_comments (
        comment_id SERIAL PRIMARY KEY,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
        user_id INTEGER,
        technician_id INTEGER REFERENCES technicians(technician_id) ON DELETE SET NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create work_order_attachments table
    console.log('📎 Creating work_order_attachments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_attachments (
        attachment_id SERIAL PRIMARY KEY,
        work_order_id INTEGER NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        uploaded_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    console.log('🔍 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
      CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_work_orders_machine_id ON work_orders(machine_id);
      CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(due_date);
      CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_work_order_parts_wo_id ON work_order_parts(work_order_id);
      CREATE INDEX IF NOT EXISTS idx_work_order_tasks_wo_id ON work_order_tasks(work_order_id);
      CREATE INDEX IF NOT EXISTS idx_work_order_comments_wo_id ON work_order_comments(work_order_id);
    `);

    // Create function to auto-generate work order numbers
    console.log('🔢 Creating work order number generator...');
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_work_order_number()
      RETURNS VARCHAR(50) AS $$
      DECLARE
        new_number VARCHAR(50);
        current_year VARCHAR(4);
        sequence_num INTEGER;
      BEGIN
        current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 8) AS INTEGER)), 0) + 1
        INTO sequence_num
        FROM work_orders
        WHERE work_order_number LIKE 'WO-' || current_year || '%';
        
        new_number := 'WO-' || current_year || '-' || LPAD(sequence_num::TEXT, 5, '0');
        
        RETURN new_number;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-update updated_at
    console.log('⏰ Creating update trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_work_order_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_work_order_timestamp ON work_orders;
      
      CREATE TRIGGER trigger_update_work_order_timestamp
        BEFORE UPDATE ON work_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_work_order_timestamp();
    `);

    await client.query('COMMIT');
    console.log('✅ Work Orders migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
createWorkOrdersTables()
  .then(() => {
    console.log('🎉 Work Orders system ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create work orders tables:', error);
    process.exit(1);
  });

