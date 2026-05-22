// src/repositories/usersRepo.js
const baseColumns = `user_id, tenant_id, email, display_name, status, created_at`;

const findByEmail = async (db, tenantId, email) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}, password_hash
       FROM auth.users
      WHERE tenant_id = $1 AND lower(email) = lower($2)`,
    [tenantId, email]
  );
  return rows[0] || null;
};

const findById = async (db, tenantId, userId) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}
       FROM auth.users
      WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId]
  );
  return rows[0] || null;
};

const list = async (db, tenantId) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}
       FROM auth.users
      WHERE tenant_id = $1
      ORDER BY user_id ASC`,
    [tenantId]
  );
  return rows;
};

const insert = async (db, { tenant_id, email, password_hash, display_name }) => {
  const { rows } = await db.query(
    `INSERT INTO auth.users (tenant_id, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${baseColumns}`,
    [tenant_id, email, password_hash, display_name]
  );
  return rows[0];
};

const updateStatus = async (db, tenantId, userId, status) => {
  const { rows } = await db.query(
    `UPDATE auth.users SET status = $1
      WHERE tenant_id = $2 AND user_id = $3
      RETURNING ${baseColumns}`,
    [status, tenantId, userId]
  );
  return rows[0] || null;
};

const updatePassword = async (db, tenantId, userId, password_hash) => {
  const { rowCount } = await db.query(
    `UPDATE auth.users SET password_hash = $1
      WHERE tenant_id = $2 AND user_id = $3`,
    [password_hash, tenantId, userId]
  );
  return rowCount === 1;
};

module.exports = { findByEmail, findById, list, insert, updateStatus, updatePassword };
