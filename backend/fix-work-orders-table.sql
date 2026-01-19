-- Quick fix for work_orders table to use machine_name instead of machine_id
-- Run this SQL directly in your PostgreSQL database

-- Step 1: Drop the foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'work_orders_machine_id_fkey' 
        AND table_name = 'work_orders'
    ) THEN
        ALTER TABLE work_orders DROP CONSTRAINT work_orders_machine_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint';
    END IF;
END $$;

-- Step 2: Add machine_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'machine_name'
    ) THEN
        ALTER TABLE work_orders ADD COLUMN machine_name VARCHAR(255);
        RAISE NOTICE 'Added machine_name column';
    END IF;
END $$;

-- Step 3: Add technician_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'technician_name'
    ) THEN
        ALTER TABLE work_orders ADD COLUMN technician_name VARCHAR(255);
        RAISE NOTICE 'Added technician_name column';
    END IF;
END $$;

-- Step 4: Migrate existing data if machine_id column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'machine_id'
    ) THEN
        -- Copy machine names from machines table to work_orders (for non-null machine_ids)
        UPDATE work_orders wo
        SET machine_name = m.name
        FROM machines m
        WHERE wo.machine_id = m.machine_id 
        AND wo.machine_name IS NULL
        AND wo.machine_id IS NOT NULL
        AND wo.machine_id != 0;  -- Skip invalid machine_id = 0
        
        RAISE NOTICE 'Migrated existing machine data';

        -- Drop the machine_id column
        ALTER TABLE work_orders DROP COLUMN machine_id;
        RAISE NOTICE 'Dropped machine_id column';
    END IF;
END $$;

-- Verify the changes
SELECT 
    'work_orders table structure:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders'
ORDER BY ordinal_position;







