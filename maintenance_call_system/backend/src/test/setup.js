// Provide a deterministic JWT secret for tests before any module that reads it
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.NODE_ENV = 'test';
