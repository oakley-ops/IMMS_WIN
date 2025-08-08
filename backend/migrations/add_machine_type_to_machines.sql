-- Add machine_type column to machines table for PM interval support
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS machine_type VARCHAR(255) DEFAULT 'Default';

-- Update existing machines with a default machine type based on their name/model
UPDATE machines SET machine_type = 'ATM' WHERE name ILIKE '%atm%' OR model ILIKE '%atm%';
UPDATE machines SET machine_type = 'Printer' WHERE name ILIKE '%printer%' OR model ILIKE '%printer%';
UPDATE machines SET machine_type = 'Server' WHERE name ILIKE '%server%' OR model ILIKE '%server%';
UPDATE machines SET machine_type = 'Network Equipment' WHERE name ILIKE '%network%' OR model ILIKE '%network%' OR name ILIKE '%router%' OR name ILIKE '%switch%';
UPDATE machines SET machine_type = 'HVAC' WHERE name ILIKE '%hvac%' OR model ILIKE '%hvac%' OR name ILIKE '%air%' OR name ILIKE '%heating%';

-- Create index for machine_type for performance
CREATE INDEX IF NOT EXISTS idx_machines_machine_type ON machines(machine_type); 