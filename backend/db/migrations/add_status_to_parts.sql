-- Add status column to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- Update existing parts to be active
UPDATE parts SET status = 'active' WHERE status IS NULL;
