const jwt = require('jsonwebtoken');
const { pool } = require('../../db');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided or invalid format.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if pool is available
    if (!pool || typeof pool.query !== 'function') {
      console.error('Database pool not available in auth middleware');
      // Set basic user info without database lookup
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'admin' // Default to admin role temporarily
      };
      return next();
    }
    
    try {
      // Get user from database to ensure they still exist and get current role
      const result = await pool.query(
        'SELECT id, username, role FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
      }
      
      // Set user information in request object
      req.user = {
        id: result.rows[0].id,
        username: result.rows[0].username,
        role: result.rows[0].role || 'admin' // Fallback to admin if role isn't set
      };
    } catch (dbError) {
      console.error('Database error in auth middleware:', dbError);
      // Set basic user info without database lookup
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'admin' // Default to admin role temporarily
      };
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;