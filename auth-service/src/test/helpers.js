// src/test/helpers.js
// Test helpers. The integration tests assume:
//   - NODE_ENV=test
//   - the auth schema is applied to the configured DB
//   - a fresh admin user is created per test run

const request = require('supertest');
const buildApp = require('../app');
const { pool } = require('../database');
const password = require('../lib/password');
const tenantsRepo = require('../repositories/tenantsRepo');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');

const ensureTenant = async (slug = 'fiserv', display_name = 'Fiserv') => {
  let tenant = await tenantsRepo.findBySlug(pool, slug);
  if (!tenant) tenant = await tenantsRepo.insert(pool, { slug, display_name });
  return tenant;
};

const createTestUser = async (tenantId, { email, password: plaintext, roles = [] }) => {
  const existing = await usersRepo.findByEmail(pool, tenantId, email);
  if (existing) {
    await pool.query(`DELETE FROM auth.users WHERE user_id = $1`, [existing.user_id]);
  }
  const user = await usersRepo.insert(pool, {
    tenant_id: tenantId,
    email,
    password_hash: await password.hash(plaintext),
    display_name: email,
  });
  await rolesRepo.setRolesForUser(pool, user.user_id, roles);
  return user;
};

const app = buildApp();
const agent = () => request.agent(app);

module.exports = { app, agent, ensureTenant, createTestUser, pool };
