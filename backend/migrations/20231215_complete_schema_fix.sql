-- Complete Work Orders Schema Fix
-- This updates both machine and technician fields to use names instead of IDs

BEGIN;

-- ===== MACHINE FIELDS FIX =====

-- Drop machine foreign key constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_machine_id_fkey;

-- Add machine columns
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS machine_location VARCHAR(255);

-- Copy existing machine data (if any)
UPDATE work_orders wo 
SET machine_name = m.machine_name 
FROM machines m 
WHERE wo.machine_id = m.machine_id
  AND wo.machine_name IS NULL;

-- Drop old machine_id column
ALTER TABLE work_orders DROP COLUMN IF EXISTS machine_id;


-- ===== TECHNICIAN FIELDS FIX =====

-- Drop technician foreign key constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_assigned_to_fkey;

-- Add technician_name column
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);

-- Copy existing technician data (if any)
UPDATE work_orders wo 
SET technician_name = u.username 
FROM users u 
WHERE wo.assigned_to = u.id
  AND wo.technician_name IS NULL;

-- Drop old assigned_to column
ALTER TABLE work_orders DROP COLUMN IF EXISTS assigned_to;

COMMIT;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND column_name IN ('machine_id', 'machine_name', 'machine_location', 'assigned_to', 'technician_name')
ORDER BY column_name;

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ Schema update complete!';
    RAISE NOTICE 'Machine ID → Machine Name + Location';
    RAISE NOTICE 'Assigned To ID → Technician Name';
END $$;







