// src/middleware/requireRole.js
const { DomainError } = require('../lib/errors');

const requireRole = (...allowed) => (req, res, next) => {
  const roles = req.user?.roles || [];
  if (roles.some((r) => allowed.includes(r))) return next();
  return next(new DomainError('forbidden', 'Insufficient role', 403));
};

module.exports = requireRole;
