-- Add shift_name to maintenance_calls if not already present
ALTER TABLE maintenance_calls ADD COLUMN IF NOT EXISTS shift_name VARCHAR(50);
