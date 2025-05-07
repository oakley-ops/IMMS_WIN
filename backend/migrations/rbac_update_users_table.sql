-- Update users table to enforce role constraints
ALTER TABLE users
DROP CONSTRAINT IF EXISTS valid_role;

-- Add constraint to limit roles
ALTER TABLE users
ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'tech', 'purchasing'));

-- Update any existing users with invalid roles to 'admin'
UPDATE users
SET role = 'admin'
WHERE role NOT IN ('admin', 'tech', 'purchasing');

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); 