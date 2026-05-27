const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { errors } = require('../middleware/errors');
const S = require('../schemas/permissions');
const repo = require('../repositories/permissionsRepo');

const handler = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    (req.log || console).error(err);
    return errors.serverError(res);
  });

// All three routes are admin-only: auth + role check.
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return errors.forbidden(res, 'Admin access required');
  return next();
};

// ─── GET / — list all IMMS users with resolved MCS permissions ───────────────

router.get(
  '/',
  auth,
  adminOnly,
  handler(async (req, res) => {
    const users = await repo.listUsersWithPermissions(db);
    return res.json(users);
  })
);

// ─── GET /:userId — single user's permissions ────────────────────────────────

router.get(
  '/:userId',
  auth,
  adminOnly,
  validate({ params: S.userIdParam }),
  handler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    // Verify user exists in IMMS. NOTE: PK is user_id, not id.
    const userResult = await db.query(
      'SELECT user_id, username, role FROM users WHERE user_id = $1',
      [userId]
    );
    if (!userResult.rows[0]) return errors.notFound(res, 'User not found');
    const user = userResult.rows[0];

    // Get stored permission row (may be all-false defaults).
    const stored = await repo.getPermissions(db, userId);

    // Resolve effective permissions.
    const perms = user.role === 'admin'
      ? repo.adminPerms()
      : repo.mergeRoleDefaults(user.role, stored);

    // Resolve updated_by username if present.
    let updatedByUsername = null;
    if (stored.updated_by) {
      const adminResult = await db.query(
        'SELECT username FROM users WHERE user_id = $1',
        [stored.updated_by]
      );
      updatedByUsername = adminResult.rows[0]?.username || null;
    }

    return res.json({
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      permissions: perms,
      updated_at: stored.updated_at,
      updated_by_username: updatedByUsername,
    });
  })
);

// ─── PUT /:userId — save permissions (admin only) ────────────────────────────

router.put(
  '/:userId',
  auth,
  adminOnly,
  validate({ params: S.userIdParam, body: S.updatePermissionsBody }),
  handler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    // Verify user exists. NOTE: PK is user_id.
    const userResult = await db.query(
      'SELECT user_id, username, role FROM users WHERE user_id = $1',
      [userId]
    );
    if (!userResult.rows[0]) return errors.notFound(res, 'User not found');
    const user = userResult.rows[0];

    // Merge body with current stored values (partial update).
    const current = await repo.getPermissions(db, userId);
    const merged = {
      badges_add:       req.body.badges_add       ?? current.badges_add,
      readers_manage:   req.body.readers_manage   ?? current.readers_manage,
      calls_manage:     req.body.calls_manage     ?? current.calls_manage,
      analytics_view:   req.body.analytics_view   ?? current.analytics_view,
      skilled_operator: req.body.skilled_operator ?? current.skilled_operator,
    };

    const saved = await repo.upsertPermissions(db, userId, merged, req.user.id);

    // Resolve effective permissions for response.
    const perms = user.role === 'admin'
      ? repo.adminPerms()
      : repo.mergeRoleDefaults(user.role, saved);

    // Resolve updated_by username.
    let updatedByUsername = null;
    if (saved.updated_by) {
      const adminResult = await db.query(
        'SELECT username FROM users WHERE user_id = $1',
        [saved.updated_by]
      );
      updatedByUsername = adminResult.rows[0]?.username || null;
    }

    return res.json({
      user_id: userId,
      username: user.username,
      role: user.role,
      permissions: perms,
      updated_at: saved.updated_at,
      updated_by_username: updatedByUsername,
    });
  })
);

module.exports = router;
