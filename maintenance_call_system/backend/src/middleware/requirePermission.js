const db = require('../database/db');
const { errors } = require('./errors');
const { ROLE_DEFAULTS } = require('../repositories/permissionsRepo');

// Keys that can be checked — validates at factory time to catch typos.
const VALID_KEYS = new Set([
  'badges_add',
  'readers_manage',
  'calls_manage',
  'analytics_view',
  'skilled_operator',
]);

/**
 * Returns Express middleware that enforces a single MCS permission.
 * Usage: router.post('/admin/badges', auth, requirePermission('badges_add'), handler(...))
 *
 * Resolution order:
 *   1. admin role → always pass
 *   2. role default for the caller's role → pass
 *   3. mcs_user_permissions row for user_id → pass if column is true
 *   4. otherwise → 403
 */
const requirePermission = (key) => {
  if (!VALID_KEYS.has(key)) {
    throw new Error(`Unknown permission key: "${key}". Valid keys: ${[...VALID_KEYS].join(', ')}`);
  }

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user?.id) return errors.unauthorized(res, 'Authentication required');

      // Admin bypasses all checks.
      if (user.role === 'admin') return next();

      // Role default bypasses DB lookup.
      const roleDefaults = ROLE_DEFAULTS[user.role];
      if (roleDefaults && roleDefaults[key]) return next();

      // Check explicit grant in DB.
      // NOTE: req.user.id maps to users.user_id in the DB (JWT uses 'id' field name).
      const result = await db.query(
        `SELECT badges_add, readers_manage, calls_manage, analytics_view, skilled_operator
           FROM mcs_user_permissions WHERE user_id = $1`,
        [user.id]
      );
      const row = result.rows[0];
      if (row && row[key] === true) return next();

      return errors.forbidden(res, 'Insufficient MCS permissions');
    } catch (err) {
      return errors.serverError(res);
    }
  };
};

module.exports = requirePermission;
