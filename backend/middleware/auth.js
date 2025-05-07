const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  console.log('Auth debug:', {
    path: req.path,
    method: req.method,
    hasAuthHeader: !!authHeader,
    headerPrefix: authHeader ? authHeader.substring(0, 15) + '...' : 'none'
  });
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Authentication failed: No valid Authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('Authentication failed: Token not found in Authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Token verified successfully for user:', decoded.username || decoded.email || 'unknown');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  authenticateToken
}; 