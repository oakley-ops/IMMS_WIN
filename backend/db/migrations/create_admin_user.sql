-- First, remove any existing admin user
DELETE FROM users WHERE username = 'admin';

-- Create admin user with password 'admin123'
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$ZHVXRlNVUjVBQUFBQUFBT.Ry7fHGwVq5N5nR5N5nR5N5nR5N5nR5',
    'admin'
); 