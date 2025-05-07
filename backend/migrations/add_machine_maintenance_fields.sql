-- Add new columns to machines table
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
ADD COLUMN IF NOT EXISTS installation_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS notes TEXT;
