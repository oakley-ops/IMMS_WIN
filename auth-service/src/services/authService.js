// src/services/authService.js
const password = require('../lib/password');
const { sign } = require('../lib/jwt');
const { DomainError } = require('../lib/errors');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');
const tenantsRepo = require('../repositories/tenantsRepo');

const DEFAULT_TENANT_SLUG = 'imms';

const stripSecrets = (user, roles) => {
  const { password_hash, ...safe } = user;
  return { ...safe, roles };
};

const login = async (db, { email, password: plaintext, tenant_slug }) => {
  const slug = tenant_slug || DEFAULT_TENANT_SLUG;
  const tenant = await tenantsRepo.findBySlug(db, slug);
  if (!tenant || tenant.status !== 'active') {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const user = await usersRepo.findByEmail(db, tenant.tenant_id, email);
  if (!user || user.status !== 'active') {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const ok = await password.verify(plaintext, user.password_hash);
  if (!ok) {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  const token = sign({ sub: user.user_id, tenant_id: user.tenant_id, roles });
  return { token, user: stripSecrets(user, roles) };
};

const me = async (db, { user_id, tenant_id }) => {
  const user = await usersRepo.findById(db, tenant_id, user_id);
  if (!user) throw new DomainError('unauthorized', 'User not found', 401);
  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  return stripSecrets(user, roles);
};

const refresh = async (db, { user_id, tenant_id }) => {
  const user = await me(db, { user_id, tenant_id });
  if (user.status !== 'active') {
    throw new DomainError('unauthorized', 'User disabled', 401);
  }
  const token = sign({ sub: user.user_id, tenant_id: user.tenant_id, roles: user.roles });
  return { token, user };
};

module.exports = { login, me, refresh };
