import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
db.query = vi.fn();

const requirePermission = require('./requirePermission');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => { vi.clearAllMocks(); });

describe('requirePermission', () => {
  it('throws during factory call with an unknown permission key', () => {
    expect(() => requirePermission('nonexistent_key')).toThrow('Unknown permission key');
  });

  it('calls next() immediately for admin role without querying db', async () => {
    const mw = requirePermission('badges_add');
    const req = { user: { id: 1, role: 'admin' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('calls next() for tech role with calls_manage (role default) without querying db', async () => {
    const mw = requirePermission('calls_manage');
    const req = { user: { id: 2, role: 'tech' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('calls next() for tech role with analytics_view (role default) without querying db', async () => {
    const mw = requirePermission('analytics_view');
    const req = { user: { id: 2, role: 'tech' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('queries db and calls next() when explicit grant exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ badges_add: true }] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(db.query).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when db row has the permission set to false', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ badges_add: false }] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when no row exists in db for user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is not set', async () => {
    const mw = requirePermission('badges_add');
    const req = {};
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when db query throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
