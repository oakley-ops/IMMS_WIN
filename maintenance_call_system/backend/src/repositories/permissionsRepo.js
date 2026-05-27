// Repository layer — all SQL for mcs_user_permissions lives here.
// Functions accept a db client (pool) and return plain objects.

// Defaults object when no row exists for a user.
const defaultPerms = () => ({
  badges_add: false,
  readers_manage: false,
  calls_manage: false,
  analytics_view: false,
  skilled_operator: false,
  updated_by: null,
  updated_at: null,
});

// Role-based defaults applied on top of the stored row.
const ROLE_DEFAULTS = {
  tech: { calls_manage: true, analytics_view: true },
};

// Merges explicit grants with role defaults: either source being true wins.
const mergeRoleDefaults = (role, stored) => {
  const rd = ROLE_DEFAULTS[role] || {};
  return {
    badges_add: stored.badges_add || false,
    readers_manage: stored.readers_manage || false,
    calls_manage: stored.calls_manage || rd.calls_manage || false,
    analytics_view: stored.analytics_view || rd.analytics_view || false,
    skilled_operator: stored.skilled_operator || false,
  };
};

// For admin role: all permissions are effectively true.
const adminPerms = () => ({
  badges_add: true, readers_manage: true, calls_manage: true,
  analytics_view: true, skilled_operator: true,
});

/**
 * Returns the stored permission row for a user, or all-false defaults.
 * Does NOT apply role defaults — use mergeRoleDefaults separately.
 */
const getPermissions = async (db, userId) => {
  const result = await db.query(
    `SELECT badges_add, readers_manage, calls_manage, analytics_view,
            skilled_operator, updated_by, updated_at
       FROM mcs_user_permissions
      WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || defaultPerms();
};

/**
 * Upserts a full permission set for a user.
 * `permissions` must contain all 5 boolean keys.
 * Returns the saved row.
 */
const upsertPermissions = async (db, userId, permissions, updatedBy) => {
  const result = await db.query(
    `INSERT INTO mcs_user_permissions
       (user_id, badges_add, readers_manage, calls_manage, analytics_view, skilled_operator, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       badges_add       = EXCLUDED.badges_add,
       readers_manage   = EXCLUDED.readers_manage,
       calls_manage     = EXCLUDED.calls_manage,
       analytics_view   = EXCLUDED.analytics_view,
       skilled_operator = EXCLUDED.skilled_operator,
       updated_by       = EXCLUDED.updated_by,
       updated_at       = NOW()
     RETURNING *`,
    [
      userId,
      permissions.badges_add,
      permissions.readers_manage,
      permissions.calls_manage,
      permissions.analytics_view,
      permissions.skilled_operator,
      updatedBy,
    ]
  );
  return result.rows[0];
};

/**
 * Returns all IMMS users joined with their MCS permission row.
 * Includes resolved effective permissions (role defaults merged in).
 * NOTE: users table PK is `user_id` (not `id`).
 */
const listUsersWithPermissions = async (db) => {
  const result = await db.query(
    `SELECT u.user_id,
            u.username,
            u.role,
            COALESCE(p.badges_add,       false) AS badges_add,
            COALESCE(p.readers_manage,   false) AS readers_manage,
            COALESCE(p.calls_manage,     false) AS calls_manage,
            COALESCE(p.analytics_view,   false) AS analytics_view,
            COALESCE(p.skilled_operator, false) AS skilled_operator,
            p.updated_by,
            p.updated_at,
            adm.username                         AS updated_by_username
       FROM users u
  LEFT JOIN mcs_user_permissions p   ON p.user_id = u.user_id
  LEFT JOIN users adm                ON adm.user_id = p.updated_by
      ORDER BY u.username`
  );
  return result.rows.map((row) => {
    const { user_id, username, role, updated_at, updated_by_username, ...stored } = row;
    const perms = role === 'admin'
      ? adminPerms()
      : mergeRoleDefaults(role, stored);
    return { user_id, username, role, permissions: perms, updated_at, updated_by_username };
  });
};

module.exports = { getPermissions, upsertPermissions, listUsersWithPermissions, mergeRoleDefaults, defaultPerms, adminPerms, ROLE_DEFAULTS };
