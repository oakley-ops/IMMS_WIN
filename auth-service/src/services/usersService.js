// src/services/usersService.js
const password = require('../lib/password');
const { DomainError } = require('../lib/errors');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');

const withRoles = async (db, user) => {
  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  return { ...user, roles };
};

const list = async (db, tenantId) => {
  const users = await usersRepo.list(db, tenantId);
  return Promise.all(users.map((u) => withRoles(db, u)));
};

const get = async (db, tenantId, userId) => {
  const user = await usersRepo.findById(db, tenantId, userId);
  if (!user) throw new DomainError('not_found', 'User not found', 404);
  return withRoles(db, user);
};

const create = async (db, tenantId, { email, display_name, password: plaintext, roles }) => {
  const existing = await usersRepo.findByEmail(db, tenantId, email);
  if (existing) throw new DomainError('conflict', 'Email already exists in this tenant', 409);

  const password_hash = await password.hash(plaintext);
  const user = await usersRepo.insert(db, { tenant_id: tenantId, email, password_hash, display_name });
  const assigned = await rolesRepo.setRolesForUser(db, user.user_id, roles);
  return { ...user, roles: assigned };
};

const update = async (db, tenantId, userId, patch) => {
  const existing = await usersRepo.findById(db, tenantId, userId);
  if (!existing) throw new DomainError('not_found', 'User not found', 404);

  if (patch.status) {
    await usersRepo.updateStatus(db, tenantId, userId, patch.status);
  }
  if (patch.password) {
    const hashed = await password.hash(patch.password);
    await usersRepo.updatePassword(db, tenantId, userId, hashed);
  }
  if (patch.roles) {
    await rolesRepo.setRolesForUser(db, userId, patch.roles);
  }

  return get(db, tenantId, userId);
};

module.exports = { list, get, create, update };
