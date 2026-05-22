// src/services/usersService.test.js
const password = require('../lib/password');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');
const { DomainError } = require('../lib/errors');
const usersService = require('./usersService');

const db = { query: vi.fn() };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('usersService.create', () => {
  it('creates a user, hashes password, and assigns roles', async () => {
    vi.spyOn(usersRepo, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(usersRepo, 'insert').mockResolvedValue({ user_id: 7, tenant_id: 1, email: 'a@b', display_name: 'A', status: 'active' });
    vi.spyOn(rolesRepo, 'setRolesForUser').mockResolvedValue(['mcs.tech']);
    const hashSpy = vi.spyOn(password, 'hash').mockImplementation(async (p) => `hashed:${p}`);

    const out = await usersService.create(db, 1, { email: 'a@b', display_name: 'A', password: 'longpass123', roles: ['mcs.tech'] });

    expect(hashSpy).toHaveBeenCalledWith('longpass123');
    expect(usersRepo.insert).toHaveBeenCalledWith(db, {
      tenant_id: 1, email: 'a@b', password_hash: 'hashed:longpass123', display_name: 'A',
    });
    expect(rolesRepo.setRolesForUser).toHaveBeenCalledWith(db, 7, ['mcs.tech']);
    expect(out).toMatchObject({ user_id: 7, email: 'a@b', roles: ['mcs.tech'] });
  });

  it('throws conflict if email already exists', async () => {
    vi.spyOn(usersRepo, 'findByEmail').mockResolvedValue({ user_id: 1 });
    await expect(
      usersService.create(db, 1, { email: 'a@b', display_name: 'A', password: 'longpass123', roles: [] })
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('usersService.list', () => {
  it('returns users in the given tenant with role keys', async () => {
    vi.spyOn(usersRepo, 'list').mockResolvedValue([
      { user_id: 1, tenant_id: 1, email: 'a@b', display_name: 'A', status: 'active' },
      { user_id: 2, tenant_id: 1, email: 'c@d', display_name: 'C', status: 'active' },
    ]);
    const findKeys = vi.spyOn(rolesRepo, 'findKeysForUser');
    findKeys.mockResolvedValueOnce(['mcs.admin']).mockResolvedValueOnce(['mcs.tech']);
    const out = await usersService.list(db, 1);
    expect(out).toHaveLength(2);
    expect(out[0].roles).toEqual(['mcs.admin']);
    expect(out[1].roles).toEqual(['mcs.tech']);
  });
});

describe('usersService.update', () => {
  it('updates status when provided', async () => {
    vi.spyOn(usersRepo, 'findById')
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' })
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'disabled' });
    const statusSpy = vi.spyOn(usersRepo, 'updateStatus').mockResolvedValue({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'disabled' });
    vi.spyOn(rolesRepo, 'findKeysForUser').mockResolvedValue([]);
    const out = await usersService.update(db, 1, 7, { status: 'disabled' });
    expect(statusSpy).toHaveBeenCalledWith(db, 1, 7, 'disabled');
    expect(out.status).toBe('disabled');
  });

  it('throws not_found if user does not exist in tenant', async () => {
    vi.spyOn(usersRepo, 'findById').mockResolvedValue(null);
    await expect(usersService.update(db, 1, 99, { status: 'disabled' }))
      .rejects.toMatchObject({ code: 'not_found' });
  });

  it('hashes the password and calls updatePassword when patch.password is provided', async () => {
    const findById = vi.spyOn(usersRepo, 'findById')
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' })  // initial check
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' }); // get() at end
    const hashSpy = vi.spyOn(password, 'hash').mockImplementation(async (p) => `hashed:${p}`);
    const updatePwd = vi.spyOn(usersRepo, 'updatePassword').mockResolvedValue(true);
    vi.spyOn(rolesRepo, 'findKeysForUser').mockResolvedValue([]);

    await usersService.update(db, 1, 7, { password: 'new-strong-pw' });

    expect(hashSpy).toHaveBeenCalledWith('new-strong-pw');
    expect(updatePwd).toHaveBeenCalledWith(db, 1, 7, 'hashed:new-strong-pw');
  });

  it('calls setRolesForUser when patch.roles is provided', async () => {
    vi.spyOn(usersRepo, 'findById')
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' })
      .mockResolvedValueOnce({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' });
    const setRoles = vi.spyOn(rolesRepo, 'setRolesForUser').mockResolvedValue(['mcs.tech']);
    vi.spyOn(rolesRepo, 'findKeysForUser').mockResolvedValue(['mcs.tech']);

    await usersService.update(db, 1, 7, { roles: ['mcs.tech'] });

    expect(setRoles).toHaveBeenCalledWith(db, 7, ['mcs.tech']);
  });
});
