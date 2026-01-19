-- Fix Work Orders Schema
-- This updates the work_orders table to store machine_name directly instead of machine_id foreign key

BEGIN;

-- Step 1: Drop the foreign key constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_machine_id_fkey;

-- Step 2: Add machine_name column if it doesn't exist
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255);

-- Step 3: Copy existing machine names from machines table (if any data exists)
UPDATE work_orders wo 
SET machine_name = m.machine_name 
FROM machines m 
WHERE wo.machine_id = m.machine_id
  AND wo.machine_name IS NULL;

-- Step 4: Drop the machine_id column
ALTER TABLE work_orders DROP COLUMN IF EXISTS machine_id;

-- Step 5: Add machine_location column for convenience
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS machine_location VARCHAR(255);

COMMIT;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND column_name IN ('machine_id', 'machine_name', 'machine_location')
ORDER BY column_name;







