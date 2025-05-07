-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  ip_address VARCHAR(45) NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on login_attempts for user_id and ip_address
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts(ip_address);

-- Create initial admin user with password 'admin123'
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2b$10$rMUXoEYkwXD.Tz.0icQkXOBwRQIJqRhqrnL8HzKWXqR1VlhKP3vPi', 'admin')
ON CONFLICT (username) DO NOTHING; 