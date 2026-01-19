-- Add compatible_die_types column to machines for die compatibility validation
-- This restricts which die types can be installed in each machine

BEGIN;

-- Add array column to store compatible die types (e.g., ['4 up die', '8 up die'])
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS compatible_die_types TEXT[];

-- Add comment explaining the field
COMMENT ON COLUMN machines.compatible_die_types IS 'Array of die types that can be installed in this machine (e.g., 4 up die, 8 up die)';

COMMIT;
