-- Migration to change work_orders table to use machine_name (text) instead of machine_id (foreign key)
-- This allows users to manually type in machine names

-- First, let's check if the work_orders table exists and modify it
DO $$ 
BEGIN
    -- Check if work_orders table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'work_orders') THEN
        -- Drop the foreign key constraint if it exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'work_orders_machine_id_fkey' 
            AND table_name = 'work_orders'
        ) THEN
            ALTER TABLE work_orders DROP CONSTRAINT work_orders_machine_id_fkey;
            RAISE NOTICE 'Dropped foreign key constraint work_orders_machine_id_fkey';
        END IF;

        -- Add machine_name column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name = 'machine_name'
        ) THEN
            ALTER TABLE work_orders ADD COLUMN machine_name VARCHAR(255);
            RAISE NOTICE 'Added machine_name column';
        END IF;

        -- Migrate existing data if machine_id exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name = 'machine_id'
        ) THEN
            -- Copy machine names from machines table to work_orders
            UPDATE work_orders wo
            SET machine_name = m.name
            FROM machines m
            WHERE wo.machine_id = m.machine_id AND wo.machine_name IS NULL;
            
            RAISE NOTICE 'Migrated existing machine data';

            -- Drop the machine_id column
            ALTER TABLE work_orders DROP COLUMN machine_id;
            RAISE NOTICE 'Dropped machine_id column';
        END IF;

        -- Add technician_name column if it doesn't exist (for manual entry)
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name = 'technician_name'
        ) THEN
            ALTER TABLE work_orders ADD COLUMN technician_name VARCHAR(255);
            RAISE NOTICE 'Added technician_name column';
        END IF;

        RAISE NOTICE 'Work orders table successfully updated to use machine_name instead of machine_id';
    ELSE
        -- Create the work_orders table if it doesn't exist
        CREATE TABLE work_orders (
            work_order_id SERIAL PRIMARY KEY,
            work_order_number VARCHAR(100) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            machine_name VARCHAR(255),  -- Text field for manual entry
            technician_name VARCHAR(255),  -- Text field for manual entry
            status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
            priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            scheduled_date DATE,
            completed_date DATE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(255),
            assigned_to VARCHAR(255)
        );

        -- Create indexes for better performance
        CREATE INDEX idx_work_orders_status ON work_orders(status);
        CREATE INDEX idx_work_orders_work_order_number ON work_orders(work_order_number);
        CREATE INDEX idx_work_orders_machine_name ON work_orders(machine_name);
        
        RAISE NOTICE 'Created work_orders table with machine_name field';
    END IF;
END $$;







