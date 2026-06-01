const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('requireDemoMode middleware', () => {
  const makeApp = (demoMode) => {
    const app = express();
    process.env.DEMO_MODE = demoMode ? 'true' : '';
    const requireDemoMode = require('../middleware/requireDemoMode');
    app.get('/test', requireDemoMode, (req, res) => res.json({ ok: true }));
    return app;
  };

  afterEach(() => { delete process.env.DEMO_MODE; });

  it('returns 404 when DEMO_MODE is not set', async () => {
    const app = makeApp(false);
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
  });

  it('calls next() when DEMO_MODE=true', async () => {
    const app = makeApp(true);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// Mock DB so tests don't need a real Postgres connection
jest.mock('../../db', () => ({
  query: jest.fn(),
}));
const db = require('../../db');

function makeRouteApp(demoMode = true) {
  process.env.DEMO_MODE = demoMode ? 'true' : '';
  process.env.JWT_SECRET = 'test-secret';
  const app = express();
  app.use(express.json());
  const demoRoutes = require('../routes/demoRoutes');
  app.use('/api/v1/demo', demoRoutes);
  return app;
}

describe('GET /api/v1/demo/config', () => {
  afterEach(() => { delete process.env.DEMO_MODE; db.query.mockClear(); });

  it('returns demoMode true and roles when DEMO_MODE=true', async () => {
    const app = makeRouteApp(true);
    const res = await request(app).get('/api/v1/demo/config');
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(true);
    expect(res.body.roles).toEqual(['admin', 'purchaser', 'viewer']);
  });

  it('returns 404 when DEMO_MODE not set', async () => {
    const app = makeRouteApp(false);
    const res = await request(app).get('/api/v1/demo/config');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/demo/login', () => {
  afterEach(() => { delete process.env.DEMO_MODE; db.query.mockClear(); });

  it('mints a JWT for admin role', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ user_id: 1, username: 'demo-admin', role: 'admin' }]
    });
    const app = makeRouteApp(true);
    const res = await request(app)
      .post('/api/v1/demo/login')
      .query({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const decoded = jwt.verify(res.body.token, 'test-secret');
    expect(decoded.role).toBe('admin');
  });

  it('returns 400 for an invalid role', async () => {
    const app = makeRouteApp(true);
    const res = await request(app)
      .post('/api/v1/demo/login')
      .query({ role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/demo/reset', () => {
  afterEach(() => { delete process.env.DEMO_MODE; db.query.mockClear(); });

  it('returns 403 when called as non-admin', async () => {
    const app = makeRouteApp(true);
    const token = jwt.sign({ role: 'purchaser', username: 'demo-purchaser' }, 'test-secret');
    const res = await request(app)
      .post('/api/v1/demo/reset')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
