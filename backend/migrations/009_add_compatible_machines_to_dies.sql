-- Add compatible_machine_ids column to dies for specific die-to-machine mapping
-- Each die can specify which machines it's allowed to be installed in

BEGIN;

-- Add array column to store compatible machine IDs
ALTER TABLE dies
ADD COLUMN IF NOT EXISTS compatible_machine_ids INTEGER[];

-- Add comment explaining the field
COMMENT ON COLUMN dies.compatible_machine_ids IS 'Array of machine IDs that this die can be installed in. If empty/null, die can go in any die press machine.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dies_compatible_machines ON dies USING GIN (compatible_machine_ids);

COMMIT;
