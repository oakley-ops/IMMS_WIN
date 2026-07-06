const express = require('express');
const request = require('supertest');
const securityHeaders = require('../../../src/middleware/securityHeaders');

const makeApp = () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/t', (req, res) => res.send('ok'));
  return app;
};

describe('securityHeaders middleware', () => {
  test('sets X-Frame-Options SAMEORIGIN and nosniff, and a referrer policy', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  test('removes x-powered-by', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('does NOT set a Content-Security-Policy (intentionally disabled)', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
