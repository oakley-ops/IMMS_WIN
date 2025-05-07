const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController.js');
const authMiddleware = require('../middleware/authMiddleware');
const { pool } = require('../config/db');
const roleAuthorization = require('../middleware/roleMiddleware');
const bcrypt = require('bcrypt');

// Define role permissions
const ROLES = {
  ADMIN_ONLY: ['admin']
};

// User routes
router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.get('/profile', authMiddleware, UserController.getProfile);
router.put('/profile', authMiddleware, UserController.updateProfile);

// Get all users (admin only)
router.get('/', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, last_login, created_at, updated_at FROM users ORDER BY username'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT id, username, email, role, last_login, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (admin only)
router.post('/', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Validate role
    const validRoles = ['admin', 'tech', 'purchasing'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role specified',
        validRoles
      });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, password, email, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING id, username, email, role, created_at`,
      [username, hashedPassword, email, role]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user role (admin only)
router.put('/:id/role', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['admin', 'tech', 'purchasing'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role specified',
        validRoles
      });
    }
    
    // Prevent changing own role
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }
    
    // Update user role
    const result = await pool.query(
      `UPDATE users 
       SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, username, email, role, updated_at`,
      [role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting own account
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }
    
    // Delete user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;