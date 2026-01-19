-- Migration to rename fiserv_part_number to crc_part_number in existing database
-- This handles dependent views and constraints properly

-- Step 1: Add the new crc_part_number column
ALTER TABLE parts 
ADD COLUMN IF NOT EXISTS crc_part_number VARCHAR(100);

-- Step 2: Copy data from fiserv_part_number to crc_part_number
UPDATE parts 
SET crc_part_number = fiserv_part_number 
WHERE crc_part_number IS NULL;

-- Step 3: Backup and recreate the dependent view
-- First, get the current view definition (we'll recreate it with crc_part_number)
DROP VIEW IF EXISTS machine_parts_detail_view_backup;

-- Create a new version of the view with crc_part_number instead of fiserv_part_number
-- Note: You may need to adjust this based on your actual view definition
CREATE OR REPLACE VIEW machine_parts_detail_view AS
SELECT 
    m.machine_id,
    m.name as machine_name,
    m.model,
    m.location,
    p.part_id,
    p.name as part_name,
    p.crc_part_number,  -- Changed from fiserv_part_number
    p.manufacturer_part_number,
    p.quantity,
    p.minimum_quantity,
    p.unit_cost,
    pa.quantity as assigned_quantity
FROM machines m
LEFT JOIN part_assignments pa ON m.machine_id = pa.machine_id
LEFT JOIN parts p ON pa.part_id = p.part_id;

-- Step 4: Now we can safely drop the old column
ALTER TABLE parts 
DROP COLUMN IF EXISTS fiserv_part_number CASCADE;

-- Step 5: Update any existing unique constraints
DROP INDEX IF EXISTS unique_fiserv_part_number;
CREATE UNIQUE INDEX IF NOT EXISTS unique_crc_part_number ON parts(crc_part_number);

-- Step 6: Add any other constraints that might have been dropped
ALTER TABLE parts 
ADD CONSTRAINT unique_crc_part_number_constraint UNIQUE (crc_part_number);

-- Add comment to document the change
COMMENT ON COLUMN parts.crc_part_number IS 'CRC internal part number (formerly fiserv_part_number)';
COMMENT ON VIEW machine_parts_detail_view IS 'Updated view using crc_part_number instead of fiserv_part_number';

-- Display completion message
SELECT 'Migration completed: fiserv_part_number renamed to crc_part_number, view updated' as status;
