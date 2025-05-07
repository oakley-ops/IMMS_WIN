-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create login_attempts table if it doesn't exist
DROP TABLE IF EXISTS login_attempts;
CREATE TABLE login_attempts (
    attempt_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_time ON login_attempts(created_at);

-- Create function to clean up old login attempts
CREATE OR REPLACE FUNCTION cleanup_login_attempts() RETURNS void AS $$
BEGIN
    DELETE FROM login_attempts 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Delete existing admin user if exists
DELETE FROM users WHERE username = 'admin';

-- Create new admin user with proper password hash
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2a$10$gXhblMXrfkw2DFYSxs/Tx.ygw8zLoG5jqDZk3mdVFX/tNMwV6R2WC',
    'admin'
); 