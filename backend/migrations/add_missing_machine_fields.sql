-- Add all potentially missing fields to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS next_maintenance_date DATE,
ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Make sure serial_number doesn't have unique constraint which could cause issues
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_serial_number_key;
ALTER TABLE machines ADD CONSTRAINT machines_serial_number_key UNIQUE (serial_number); 