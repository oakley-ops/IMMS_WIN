const jwt = require('jsonwebtoken');
const { errors } = require('./errors');

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errors.unauthorized(res, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errors.unauthorized(res, 'Token expired. Please login again.');
    }
    return errors.unauthorized(res, 'Invalid token.');
  }
};

module.exports = auth;
