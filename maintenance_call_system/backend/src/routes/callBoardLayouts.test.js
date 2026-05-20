import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
db.query = vi.fn();
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
db.getClient = vi.fn().mockResolvedValue(mockClient);

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const router = require('./callBoardLayouts');

const app = express();
app.use(express.json());
app.use('/', router);

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'test-secret');
const authHeader = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.query.mockResolvedValue({ rows: [] });
});

describe('GET /', () => {
  it('returns the list of layouts', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { layout_id: 1, name: 'Main Floor', orientation: 'landscape', is_default: true },
        { layout_id: 2, name: 'Press Room', orientation: 'portrait',  is_default: false },
      ],
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Main Floor');
  });
});

describe('GET /default/current', () => {
  it('returns null when no default layout exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // findDefaultLayout
    const res = await request(app).get('/default/current');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the default layout with its tiles', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ layout_id: 7, name: 'Floor', is_default: true }] }) // findDefaultLayout
      .mockResolvedValueOnce({ rows: [{ tile_id: 1, machine_id: 10, col_start: 0, row_start: 0, col_span: 2, row_span: 2 }] }); // listTilesForLayout
    const res = await request(app).get('/default/current');
    expect(res.status).toBe(200);
    expect(res.body.layout_id).toBe(7);
    expect(res.body.tiles).toHaveLength(1);
  });
});

describe('GET /:id', () => {
  it('returns the layout with its tiles', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ layout_id: 7, name: 'Floor' }] })
      .mockResolvedValueOnce({ rows: [{ tile_id: 1, machine_id: 10, col_start: 1, row_start: 1, col_span: 2, row_span: 2 }] });
    const res = await request(app).get('/7');
    expect(res.status).toBe(200);
    expect(res.body.layout_id).toBe(7);
    expect(res.body.tiles[0].machine_id).toBe(10);
  });

  it('returns 404 when the layout does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/999');
    expect(res.status).toBe(404);
  });

  it('returns 400 when id is not numeric', async () => {
    const res = await request(app).get('/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('POST /', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/').set(authHeader).send({});
    expect(res.status).toBe(400);
  });

  it('creates a layout and returns it with empty tiles', async () => {
    // BEGIN, INSERT, COMMIT — mockClient handles all of them.
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ layout_id: 42, name: 'Floor', orientation: 'landscape', is_default: false }] }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app).post('/').set(authHeader).send({ name: 'Floor' });
    expect(res.status).toBe(201);
    expect(res.body.layout_id).toBe(42);
    expect(res.body.tiles).toEqual([]);
  });
});

describe('PUT /:id/tiles', () => {
  it('returns 400 when tiles is missing', async () => {
    const res = await request(app).put('/1/tiles').set(authHeader).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when a tile has negative col_start', async () => {
    const res = await request(app).put('/1/tiles').set(authHeader).send({
      tiles: [{ machine_id: 1, col_start: -1, row_start: 0, col_span: 2, row_span: 2 }],
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the layout is missing', async () => {
    mockClient.query
      .mockResolvedValueOnce({})                    // BEGIN
      .mockResolvedValueOnce({ rows: [] });         // findLayoutById -> none
    const res = await request(app).put('/1/tiles').set(authHeader).send({ tiles: [] });
    expect(res.status).toBe(404);
  });

  it('replaces tiles and returns the new list', async () => {
    mockClient.query
      .mockResolvedValueOnce({})                                            // BEGIN
      .mockResolvedValueOnce({ rows: [{ layout_id: 1 }] })                  // findLayoutById
      .mockResolvedValueOnce({})                                            // DELETE existing tiles
      .mockResolvedValueOnce({})                                            // INSERT tile 1
      .mockResolvedValueOnce({})                                            // UPDATE layout updated_at
      .mockResolvedValueOnce({ rows: [{ tile_id: 1, machine_id: 10, col_start: 0, row_start: 0, col_span: 2, row_span: 2 }] }) // listTilesForLayout
      .mockResolvedValueOnce({});                                           // COMMIT
    const res = await request(app).put('/1/tiles').set(authHeader).send({
      tiles: [{ machine_id: 10, col_start: 0, row_start: 0, col_span: 2, row_span: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.layout_id).toBe(1);
    expect(res.body.tiles).toHaveLength(1);
  });
});

describe('DELETE /:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the layout does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/999').set(authHeader);
    expect(res.status).toBe(404);
  });

  it('deletes and returns the id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ layout_id: 7 }] });
    const res = await request(app).delete('/7').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(7);
  });
});
