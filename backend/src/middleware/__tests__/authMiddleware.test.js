// backend/src/middleware/__tests__/authMiddleware.test.js
//
// Security fix tests for authMiddleware:
//   1. Pool unavailable  → 503, never calls next()
//   2. DB query error    → 503, never calls next()
//   3. NULL role in DB   → 403, never calls next()
//   4. Valid user+role   → sets req.user, calls next() (existing happy path)

process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgres://test'; // prevent db.js process.exit

// Expose a mutable mock pool object so tests can control pool.query per-test
const mockPool = { query: jest.fn() };

jest.mock('../../../db', () => ({
  pool: mockPool,
}));

const jwt = require('jsonwebtoken');
const authMiddleware = require('../authMiddleware');

// Helper: sign a minimal token
const makeToken = (payload = {}) =>
  jwt.sign({ id: 42, username: 'tester', ...payload }, 'test-secret-key');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('authMiddleware – security fixes', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
    // Always reset pool.query to a fresh mock before each test
    mockPool.query = jest.fn();
  });

  // ── Test 1: pool unavailable → 503 ────────────────────────────────────────
  it('returns 503 when the database pool is unavailable', async () => {
    // Remove query to simulate an uninitialised pool
    mockPool.query = undefined;

    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = makeRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 2: DB query throws → 503 ─────────────────────────────────────────
  it('returns 503 when the database query throws an error', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('connection refused'));

    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = makeRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 3: user found but role is NULL → 403 ─────────────────────────────
  it('returns 403 when the user has no role assigned in the database', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ user_id: 42, username: 'tester', role: null }],
    });

    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = makeRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 4: happy path — valid user with a role ───────────────────────────
  it('calls next() and sets req.user when credentials are valid', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ user_id: 42, username: 'tester', role: 'tech' }],
    });

    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = makeRes();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 42, username: 'tester', role: 'tech' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
