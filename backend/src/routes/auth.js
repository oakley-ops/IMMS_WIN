const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { executeWithRetry } = require('../../db');
const rateLimit = require('express-rate-limit');
const { validateLogin, validatePasswordChange, sanitizeBody } = require('../middleware/validation');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes by default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true // Enable trust proxy
});

// Login route with rate limiting and input validation
router.post('/login', sanitizeBody, loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);
    // SECURITY: Never log passwords

    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Get user from database
    const userResult = await executeWithRetry(
      'SELECT user_id, username, password_hash, role FROM users WHERE username = $1',
      [username]
    );

    const user = userResult.rows[0];
    console.log('User found:', user ? 'Yes' : 'No');
    // SECURITY: Never log password hashes

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Try to log failed attempt, but don't fail if table doesn't exist
      try {
        await executeWithRetry(
          'INSERT INTO login_attempts (user_id, ip_address, success) VALUES ($1, $2, $3)',
          [user.user_id, req.ip, false]
        );
      } catch (logError) {
        console.warn('Could not log login attempt:', logError.message);
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token - require JWT_SECRET to be set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const token = jwt.sign(
      {
        id: user.user_id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Try to log successful login, but don't fail if table doesn't exist
    try {
      await executeWithRetry(
        'INSERT INTO login_attempts (user_id, ip_address, success) VALUES ($1, $2, $3)',
        [user.user_id, req.ip, true]
      );
    } catch (logError) {
      console.warn('Could not log login attempt:', logError.message);
    }

    // Try to update last login timestamp
    try {
      await executeWithRetry(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
        [user.user_id]
      );
    } catch (updateError) {
      console.warn('Could not update last login timestamp:', updateError.message);
    }

    res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database using executeWithRetry
    const userResult = await executeWithRetry(
      'SELECT user_id, username, role FROM users WHERE user_id = $1',
      [decoded.id]
    );

    if (!userResult.rows[0]) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({ 
      user: userResult.rows[0]
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Password complexity validation helper
const validatePasswordComplexity = (password) => {
  const errors = [];
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }
  return errors;
};

// Change password route with validation
router.post('/change-password', sanitizeBody, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    // Validate new password complexity
    const passwordErrors = validatePasswordComplexity(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ message: passwordErrors.join('. ') });
    }

    // Get user from database
    const userResult = await executeWithRetry(
      'SELECT * FROM users WHERE user_id = $1',
      [decoded.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await executeWithRetry(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hashedPassword, decoded.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 