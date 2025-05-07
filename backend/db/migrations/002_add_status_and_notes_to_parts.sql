-- Add status and notes columns to parts table
ALTER TABLE parts
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS notes TEXT; 