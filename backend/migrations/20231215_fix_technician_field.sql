-- Fix Work Orders - Change Technician from ID to Name
-- This allows manual entry of technician names instead of foreign key IDs

BEGIN;

-- Step 1: Drop the foreign key constraint for assigned_to
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_assigned_to_fkey;

-- Step 2: Add technician_name column if it doesn't exist
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);

-- Step 3: Copy existing technician names from users table (if any data exists)
UPDATE work_orders wo 
SET technician_name = u.username 
FROM users u 
WHERE wo.assigned_to = u.id
  AND wo.technician_name IS NULL;

-- Step 4: Drop the assigned_to column
ALTER TABLE work_orders DROP COLUMN IF EXISTS assigned_to;

COMMIT;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND column_name IN ('assigned_to', 'technician_name')
ORDER BY column_name;







