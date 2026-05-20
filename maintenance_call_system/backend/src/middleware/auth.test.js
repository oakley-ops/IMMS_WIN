import { describe, it, expect, vi, beforeEach } from 'vitest';
const jwt = require('jsonwebtoken');
const authMiddleware = require('./auth');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next() and attaches req.user when token is valid', () => {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user.id).toBe(1);
    expect(req.user.role).toBe('admin');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unauthorized',
      message: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc' } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with "Token expired" message when token is expired', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unauthorized',
      message: 'Token expired. Please login again.',
    });
  });

  it('returns 401 with "Invalid token" message when token is tampered', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unauthorized',
      message: 'Invalid token.',
    });
  });

  it('returns 401 when token is signed with the wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'a-different-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
