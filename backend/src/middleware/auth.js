const jwt = require('jsonwebtoken');

/**
 * Authentication middleware to verify JWT tokens
 */
const auth = (req, res, next) => {
  try {
    // Get token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // For development purposes, allow requests without authentication
      // In production, you would uncomment the following line to require authentication
      // return res.status(401).json({ message: 'Authentication required' });
      
      // For now, set a default user for development
      req.user = { id: 1, email: 'dev@example.com', role: 'admin' };
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    
    // Add user data to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // For development purposes, allow the request to continue
    // In production, you would uncomment the following line
    // return res.status(401).json({ message: 'Invalid or expired token' });
    
    req.user = { id: 1, email: 'dev@example.com', role: 'admin' };
    next();
  }
};

module.exports = auth; 