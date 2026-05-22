// src/repositories/tenantsRepo.js
const findById = async (db, tenantId) => {
  const { rows } = await db.query(
    `SELECT tenant_id, slug, display_name, status, created_at
       FROM auth.tenants WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0] || null;
};

const findBySlug = async (db, slug) => {
  const { rows } = await db.query(
    `SELECT tenant_id, slug, display_name, status, created_at
       FROM auth.tenants WHERE slug = $1`,
    [slug]
  );
  return rows[0] || null;
};

const insert = async (db, { slug, display_name }) => {
  const { rows } = await db.query(
    `INSERT INTO auth.tenants (slug, display_name) VALUES ($1, $2)
     RETURNING tenant_id, slug, display_name, status, created_at`,
    [slug, display_name]
  );
  return rows[0];
};

module.exports = { findById, findBySlug, insert };
