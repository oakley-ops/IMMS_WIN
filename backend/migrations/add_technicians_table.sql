-- Add technicians table for PM assignments
-- This allows tracking technician names without requiring separate user accounts

CREATE TABLE IF NOT EXISTS technicians (
    technician_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on name to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_technicians_name_unique ON technicians(name) WHERE active = true;

-- Add some sample technicians
INSERT INTO technicians (name) VALUES 
('John Smith'),
('Maria Garcia'),
('David Johnson'),
('Sarah Wilson'),
('Michael Brown')
ON CONFLICT DO NOTHING;

-- Update PM sessions table to use technician names instead of user IDs
-- First, add the new column
ALTER TABLE pm_sessions 
ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);

-- Update existing sessions to use technician names based on usernames
UPDATE pm_sessions 
SET technician_name = u.username 
FROM users u 
WHERE pm_sessions.technician_id = u.id 
AND pm_sessions.technician_name IS NULL;

-- For any sessions without matching users, set a default
UPDATE pm_sessions 
SET technician_name = 'Unknown Technician' 
WHERE technician_name IS NULL AND technician_id IS NOT NULL;

-- Add comment to explain the change
COMMENT ON COLUMN pm_sessions.technician_name IS 'Technician name for PM assignment - replaces technician_id';
COMMENT ON TABLE technicians IS 'Stores technician names for PM assignments without requiring user accounts'; 