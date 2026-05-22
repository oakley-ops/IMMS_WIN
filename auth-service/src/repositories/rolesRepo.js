// src/repositories/rolesRepo.js

const findKeysForUser = async (db, userId) => {
  const { rows } = await db.query(
    `SELECT r.key
       FROM auth.user_roles ur
       JOIN auth.roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.key);
};

const findIdsByKeys = async (db, keys) => {
  if (!keys.length) return [];
  const { rows } = await db.query(
    `SELECT role_id, key FROM auth.roles WHERE key = ANY($1)`,
    [keys]
  );
  return rows;
};

const setRolesForUser = async (db, userId, roleKeys) => {
  await db.query(`DELETE FROM auth.user_roles WHERE user_id = $1`, [userId]);
  if (!roleKeys.length) return [];
  const roles = await findIdsByKeys(db, roleKeys);
  for (const r of roles) {
    await db.query(
      `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, r.role_id]
    );
  }
  return roles.map((r) => r.key);
};

module.exports = { findKeysForUser, findIdsByKeys, setRolesForUser };
