const express = require('express');
const request = require('supertest');

describe('requireDemoMode middleware', () => {
  const makeApp = (demoMode) => {
    const app = express();
    process.env.DEMO_MODE = demoMode ? 'true' : '';
    const requireDemoMode = require('../middleware/requireDemoMode');
    app.get('/test', requireDemoMode, (req, res) => res.json({ ok: true }));
    return app;
  };

  afterEach(() => { jest.resetModules(); delete process.env.DEMO_MODE; });

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
