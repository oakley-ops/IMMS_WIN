-- Add maintenance_status column to machines table
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(20) DEFAULT 'none'; 