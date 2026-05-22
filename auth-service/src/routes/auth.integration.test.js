// src/routes/auth.integration.test.js
const { agent, ensureTenant, createTestUser, pool } = require('../test/helpers');

const EMAIL = 'integration@fiserv.test';
const PASSWORD = 'integration-pw-1234';

let tenant;

beforeAll(async () => {
  tenant = await ensureTenant('fiserv', 'Fiserv');
  await createTestUser(tenant.tenant_id, { email: EMAIL, password: PASSWORD, roles: ['mcs.admin'] });
});

afterAll(async () => {
  await pool.query(`DELETE FROM auth.users WHERE email = $1`, [EMAIL]);
  await pool.end();
});

describe('auth integration', () => {
  it('POST /auth/login → sets cookie and returns user', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.roles).toContain('mcs.admin');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie']?.join(';')).toMatch(/fiserv_auth=/);
  });

  it('GET /auth/me without cookie → 401', async () => {
    const res = await agent().get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('login then GET /auth/me returns the same user', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const me = await a.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(EMAIL);
    expect(me.body.user.roles).toContain('mcs.admin');
  });

  it('POST /auth/login with wrong password → 401 (no enumeration)', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('POST /auth/login with unknown email → identical 401 envelope', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: 'ghost@fiserv.test', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('POST /auth/logout clears the cookie', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const out = await a.post('/auth/logout');
    expect(out.status).toBe(200);
    const cookie = out.headers['set-cookie']?.join(';') || '';
    expect(cookie).toMatch(/fiserv_auth=;/);
    const after = await a.get('/auth/me');
    expect(after.status).toBe(401);
  });
});

describe('/admin/users integration', () => {
  it('login as admin → create user → list shows it', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });

    const create = await a.post('/admin/users').send({
      email: 'newbie@fiserv.test',
      display_name: 'Newbie',
      password: 'newbie-pw-1234',
      roles: ['mcs.tech'],
    });
    expect(create.status).toBe(201);
    expect(create.body.user.email).toBe('newbie@fiserv.test');
    expect(create.body.user.roles).toEqual(['mcs.tech']);

    const list = await a.get('/admin/users');
    expect(list.status).toBe(200);
    expect(list.body.users.find((u) => u.email === 'newbie@fiserv.test')).toBeTruthy();

    await pool.query(`DELETE FROM auth.users WHERE email = $1`, ['newbie@fiserv.test']);
  });

  it('non-admin role → 403 on /admin/users', async () => {
    await createTestUser(tenant.tenant_id, { email: 'viewer@fiserv.test', password: 'viewer-pw-1234', roles: ['mcs.viewer'] });
    const a = agent();
    await a.post('/auth/login').send({ email: 'viewer@fiserv.test', password: 'viewer-pw-1234' });
    const res = await a.get('/admin/users');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    await pool.query(`DELETE FROM auth.users WHERE email = $1`, ['viewer@fiserv.test']);
  });
});
