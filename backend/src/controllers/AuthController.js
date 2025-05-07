const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

class AuthController {
  async register(req, res) {
    const { username, password, email, role = 'tech' } = req.body;

    try {
      // Check if user exists
      const userExists = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (userExists.rows.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Validate role
      const validRoles = ['admin', 'tech', 'purchasing'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          error: 'Invalid role specified', 
          validRoles,
          providedRole: role
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const result = await pool.query(
        'INSERT INTO users (username, password, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
        [username, hashedPassword, email, role]
      );

      // Generate token
      const token = jwt.sign(
        { 
          id: result.rows[0].id, 
          username: result.rows[0].username,
          role: result.rows[0].role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        user: result.rows[0],
        token
      });
    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    const { username, password } = req.body;

    try {
      // Find user
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token with role information
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Update last login timestamp
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async verifyToken(req, res) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'SELECT id, username, email, role FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

module.exports = new AuthController(); 