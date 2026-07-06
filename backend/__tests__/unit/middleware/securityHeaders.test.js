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

  test('sets CSP in report-only mode (observes, does not enforce/block)', async () => {
    const res = await request(makeApp()).get('/t');
    // Report-only: the enforced header is absent, the report-only header is present.
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['content-security-policy-report-only']).toBeDefined();
    // Reflects real sources (jsdelivr for Bootstrap, ws/wss for Socket.io).
    expect(res.headers['content-security-policy-report-only']).toContain('cdn.jsdelivr.net');
    expect(res.headers['content-security-policy-report-only']).toContain('connect-src');
  });
});
