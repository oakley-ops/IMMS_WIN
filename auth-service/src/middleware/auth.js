// src/middleware/auth.js
const { verify } = require('../lib/jwt');
const { DomainError } = require('../lib/errors');

const COOKIE_NAME = process.env.COOKIE_NAME || 'fiserv_auth';

const requireAuth = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(new DomainError('unauthorized', 'Authentication required', 401));
  try {
    const payload = verify(token);
    req.user = {
      user_id:   payload.sub,
      tenant_id: payload.tenant_id,
      roles:     payload.roles || [],
    };
    return next();
  } catch (err) {
    return next(new DomainError('unauthorized', 'Invalid or expired token', 401));
  }
};

module.exports = { requireAuth, COOKIE_NAME };
