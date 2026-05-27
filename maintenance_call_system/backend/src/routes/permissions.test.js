import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
db.query = vi.fn();

const request = require('supertest');
const express = require('express');

// Patch auth to inject req.user. Tests that need a non-admin user
// temporarily reassign currentUser before the request.
let currentUser = { id: 1, username: 'admin', role: 'admin' };
{
  const authPath = require.resolve('../middleware/auth');
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: (req, _res, next) => { req.user = { ...currentUser }; next(); },
  };
}

const router = require('./permissions');
const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 1, username: 'admin', role: 'admin' };
});

describe('GET /mcs/permissions', () => {
  it('returns list of users with resolved permissions for admin', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 2, username: 'maria', role: 'tech',
          badges_add: true, readers_manage: false, calls_manage: false,
          analytics_view: false, skilled_operator: false,
          updated_at: null, updated_by_username: null,
        },
      ],
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_id).toBe(2);
    // badges_add = true from explicit grant
    expect(res.body[0].permissions.badges_add).toBe(true);
    // calls_manage = true from tech role default (even though stored=false)
    expect(res.body[0].permissions.calls_manage).toBe(true);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, username: 'tech1', role: 'tech' };
    const res = await request(app).get('/');
    expect(res.status).toBe(403);
  });
});

describe('GET /mcs/permissions/:userId', () => {
  it('returns resolved permissions for a single user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 5, username: 'bob', role: 'purchasing' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [{ badges_add: true, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: 1, updated_at: '2026-05-26T00:00:00Z' }] }) // perm row
      .mockResolvedValueOnce({ rows: [{ username: 'admin' }] }); // updated_by lookup
    const res = await request(app).get('/5');
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(5);
    expect(res.body.permissions.badges_add).toBe(true);
  });

  it('returns 404 when user does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/999');
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, role: 'tech' };
    const res = await request(app).get('/5');
    expect(res.status).toBe(403);
  });
});

describe('PUT /mcs/permissions/:userId', () => {
  it('saves permissions and returns the updated user object', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 5, username: 'bob', role: 'purchasing' }] }) // user exists check
      .mockResolvedValueOnce({ rows: [{ badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: null, updated_at: null }] }) // getPermissions (current)
      .mockResolvedValueOnce({ rows: [{ user_id: 5, badges_add: true, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: 1, updated_at: '2026-05-26T00:00:00Z' }] }) // upsert RETURNING *
      .mockResolvedValueOnce({ rows: [{ username: 'admin' }] }); // updated_by username lookup
    const res = await request(app).put('/5').send({ badges_add: true });
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(5);
    expect(res.body.permissions.badges_add).toBe(true);
    expect(res.body.updated_by_username).toBe('admin');
  });

  it('returns 400 for invalid body (boolean coercion fails)', async () => {
    const res = await request(app).put('/5').send({ badges_add: 'yes_please' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 404 when userId does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // user exists check returns empty
    const res = await request(app).put('/999').send({ badges_add: true });
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, role: 'tech' };
    const res = await request(app).put('/5').send({ badges_add: true });
    expect(res.status).toBe(403);
  });
});
