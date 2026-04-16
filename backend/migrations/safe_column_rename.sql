-- Safe migration to rename internal_part_number to crc_part_number
-- This approach handles dependent objects safely

-- Step 1: Add the new crc_part_number column
ALTER TABLE parts 
ADD COLUMN IF NOT EXISTS crc_part_number VARCHAR(100);

-- Step 2: Copy data from internal_part_number to crc_part_number
UPDATE parts 
SET crc_part_number = internal_part_number 
WHERE crc_part_number IS NULL;

-- Step 3: Check what views depend on the column (for information)
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition LIKE '%internal_part_number%';

-- Step 4: Drop the view that depends on internal_part_number
-- We'll recreate it in the next step
DROP VIEW IF EXISTS machine_parts_detail_view;

-- Step 5: Now we can drop the old column
ALTER TABLE parts 
DROP COLUMN internal_part_number;

-- Step 6: Recreate the view with the new column name
-- This is a common view structure - adjust if your view is different
CREATE VIEW machine_parts_detail_view AS
SELECT 
    m.machine_id,
    m.name as machine_name,
    m.model,
    m.location,
    p.part_id,
    p.name as part_name,
    p.crc_part_number,
    p.manufacturer_part_number,
    p.quantity,
    p.minimum_quantity,
    p.unit_cost,
    COALESCE(pa.quantity, 0) as assigned_quantity
FROM machines m
LEFT JOIN part_assignments pa ON m.machine_id = pa.machine_id
LEFT JOIN parts p ON pa.part_id = p.part_id;

-- Step 7: Update indexes and constraints
DROP INDEX IF EXISTS unique_internal_part_number;
CREATE UNIQUE INDEX IF NOT EXISTS unique_crc_part_number ON parts(crc_part_number);

-- Step 8: Add constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_crc_part_number_constraint'
    ) THEN
        ALTER TABLE parts ADD CONSTRAINT unique_crc_part_number_constraint UNIQUE (crc_part_number);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN parts.crc_part_number IS 'CRC internal part number (formerly internal_part_number)';
COMMENT ON VIEW machine_parts_detail_view IS 'Machine parts detail view updated for IMMS (using crc_part_number)';

-- Display completion message
SELECT 'Migration completed successfully: internal_part_number -> crc_part_number' as status;
