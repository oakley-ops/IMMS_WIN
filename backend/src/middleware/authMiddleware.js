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
    
    // Check if pool is available — fail closed, never proceed without DB
    if (!pool || typeof pool.query !== 'function') {
      console.error('Database pool not available in auth middleware');
      return res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
    }
    
    try {
      // Get user from database to ensure they still exist and get current role
      const result = await pool.query(
        'SELECT user_id, username, role FROM users WHERE user_id = $1',
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
      }
      
      // Guard against accounts with no role assigned
      const { user_id, username, role } = result.rows[0];
      if (!role) {
        return res.status(403).json({ error: 'Account has no role assigned. Contact an administrator.' });
      }

      // Set user information in request object
      req.user = { id: user_id, username, role };
    } catch (dbError) {
      console.error('Database error in auth middleware:', dbError);
      return res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
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
module.exports.authenticateToken = authMiddleware;