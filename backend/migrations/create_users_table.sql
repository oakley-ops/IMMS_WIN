-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create initial admin user (password: admin123)
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$5QZX8.lVdm5kGT8c0q5KC.F1CJDqY1GF9YV8Ut9qN8U1TIQDDtKjy',
    'admin'
) ON CONFLICT (username) DO NOTHING;
