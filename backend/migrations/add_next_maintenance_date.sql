-- Add next_maintenance_date column to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS next_maintenance_date DATE; 