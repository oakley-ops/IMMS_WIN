-- Add security fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE is_active = true;

-- Add constraint for password expiry (90 days)
ALTER TABLE users
ADD CONSTRAINT check_password_expiry 
CHECK (
    CASE 
        WHEN last_password_change IS NOT NULL 
        THEN last_password_change > CURRENT_TIMESTAMP - INTERVAL '90 days'
        ELSE true
    END
); 