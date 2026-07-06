// src/services/authService.test.js
const crypto = require('crypto');

// Stub keys before requiring anything that pulls jwt.js.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
vi.mock('../config/keys', () => ({ privateKey, publicKey }));

const password = require('../lib/password');
const { DomainError } = require('../lib/errors');

const usersRepo   = require('../repositories/usersRepo');
const rolesRepo   = require('../repositories/rolesRepo');
const tenantsRepo = require('../repositories/tenantsRepo');
const authService = require('./authService');

const FIXED_USER = {
  user_id: 42,
  tenant_id: 1,
  email: 'maria@imms',
  password_hash: '<replaced-in-beforeEach>',
  display_name: 'Maria',
  status: 'active',
};

const makeDb = () => ({ query: vi.fn() });

describe('authService.login', () => {
  beforeEach(async () => {
    FIXED_USER.password_hash = await password.hash('hunter2');
    vi.restoreAllMocks();
    vi.spyOn(tenantsRepo, 'findBySlug').mockResolvedValue({ tenant_id: 1, slug: 'imms', status: 'active' });
    vi.spyOn(usersRepo, 'findByEmail').mockResolvedValue(FIXED_USER);
    vi.spyOn(rolesRepo, 'findKeysForUser').mockResolvedValue(['mcs.admin']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a JWT and user shape on correct credentials', async () => {
    const result = await authService.login(makeDb(), { email: 'maria@imms', password: 'hunter2', tenant_slug: 'imms' });
    expect(result.token).toBeTypeOf('string');
    expect(result.user).toMatchObject({
      user_id: 42,
      tenant_id: 1,
      email: 'maria@imms',
      display_name: 'Maria',
      roles: ['mcs.admin'],
    });
    expect(result.user.password_hash).toBeUndefined();
  });

  it('throws unauthorized on wrong password', async () => {
    await expect(
      authService.login(makeDb(), { email: 'maria@imms', password: 'wrong', tenant_slug: 'imms' })
    ).rejects.toThrow(DomainError);
  });

  it('throws unauthorized on unknown email (no user enumeration)', async () => {
    usersRepo.findByEmail.mockResolvedValue(null);
    await expect(
      authService.login(makeDb(), { email: 'ghost@imms', password: 'whatever', tenant_slug: 'imms' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('throws unauthorized when tenant is missing or suspended', async () => {
    tenantsRepo.findBySlug.mockResolvedValue({ tenant_id: 1, slug: 'imms', status: 'suspended' });
    await expect(
      authService.login(makeDb(), { email: 'maria@imms', password: 'hunter2', tenant_slug: 'imms' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('throws unauthorized when user status is disabled', async () => {
    usersRepo.findByEmail.mockResolvedValue({ ...FIXED_USER, status: 'disabled' });
    await expect(
      authService.login(makeDb(), { email: 'maria@imms', password: 'hunter2', tenant_slug: 'imms' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('authService.me', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the current user without password_hash', async () => {
    vi.spyOn(usersRepo, 'findById').mockResolvedValue({ ...FIXED_USER });
    vi.spyOn(rolesRepo, 'findKeysForUser').mockResolvedValue(['mcs.tech']);
    const out = await authService.me(makeDb(), { user_id: 42, tenant_id: 1 });
    expect(out).toMatchObject({ user_id: 42, email: 'maria@imms', roles: ['mcs.tech'] });
    expect(out.password_hash).toBeUndefined();
  });
});
