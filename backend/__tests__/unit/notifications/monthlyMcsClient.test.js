const jwt = require('jsonwebtoken');
const client = require('../../../src/services/notifications/monthlyAnalytics/mcsAnalyticsClient');

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.MCS_BASE_URL = 'http://mcs.test/api/v1';
});
afterEach(() => { delete global.fetch; });

test('mintToken signs an admin token verifiable with the shared secret', () => {
  const decoded = jwt.verify(client.mintToken(), 'test-secret');
  expect(decoded.role).toBe('admin');
  expect(decoded.username).toBe('imms-scheduler');
});

test('fetchMetrics calls the metrics endpoint with a bearer token and returns JSON', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ overall: { total_calls: '5' } }) });
  const m = await client.fetchMetrics('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
  expect(m.overall.total_calls).toBe('5');
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toContain('http://mcs.test/api/v1/maintenance-calls/stats/metrics');
  expect(url).toContain('from=');
  expect(url).toContain('to=');
  expect(opts.headers.Authorization).toMatch(/^Bearer .+/);
});

test('fetchPdf returns a Buffer from the analytics/pdf endpoint', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 fake');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer });
  const buf = await client.fetchPdf('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.toString('utf8')).toContain('%PDF-1.4');
  expect(global.fetch.mock.calls[0][0]).toContain('/mcs/analytics/pdf');
});

test('throws on a non-200 response', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(client.fetchMetrics('a', 'b')).rejects.toThrow(/503/);
});
