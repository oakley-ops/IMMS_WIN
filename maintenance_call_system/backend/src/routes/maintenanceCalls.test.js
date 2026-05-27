import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prevent the real pg Pool (and its boot-time SELECT NOW()) from running.
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
// Replace db.query with a fresh vi.fn so tests can stub per-call behavior.
// The router holds a reference to the same `db` object, so this propagates.
db.query = vi.fn();

const request = require('supertest');
const express = require('express');

// Bypass JWT auth so auth-protected routes can be tested without real tokens.
// vi.mock does not intercept relative-path CJS modules in this vitest setup,
// so we patch require.cache directly before loading the router.
{
  const authPath = require.resolve('../middleware/auth');
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (_req, _res, next) => next(),
  };
}

{
  const rpPath = require.resolve('../middleware/requirePermission');
  require.cache[rpPath] = {
    id: rpPath,
    filename: rpPath,
    loaded: true,
    // Factory that always produces a pass-through middleware.
    exports: (_key) => (_req, _res, next) => next(),
  };
}

const router = require('./maintenanceCalls');

const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /badge-swipe', () => {
  it('returns 400 when badge_id is missing', async () => {
    const res = await request(app).post('/badge-swipe').send({ reader_key: 'press-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.details.some((d) => d.path === 'badge_id')).toBe(true);
  });

  it('returns 400 when reader_key is missing', async () => {
    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1' });
    expect(res.status).toBe(400);
  });

  it('returns action=unknown_badge when badge is not registered', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // badge lookup
    const res = await request(app).post('/badge-swipe').send({ badge_id: 'NOPE', reader_key: 'press-1' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('unknown_badge');
  });

  it('returns 404 when reader is not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'B1', person_name: 'Joe', role: 'operator', active: true }] })
      .mockResolvedValueOnce({ rows: [] }); // reader lookup empty
    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'missing' });
    expect(res.status).toBe(404);
  });

  it('creates a new call when an operator badges in and no active call exists', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'B1', person_name: 'Joe', role: 'operator' }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [] }) // no active call
      .mockResolvedValueOnce({ rows: [{ call_id: 99, machine_id: 10, status: 'open' }] }); // INSERT

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'press-1' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('call_created');
    expect(res.body.call.call_id).toBe(99);
    expect(res.body.machine_name).toBe('Press 701');
  });

  it('returns action=already_active when an operator badges in while a call is open', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'B1', person_name: 'Joe', role: 'operator' }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'open' }] }); // existing call

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'press-1' });
    expect(res.body.action).toBe('already_active');
    expect(res.body.call.call_id).toBe(5);
  });

  it('acknowledges an open call when a technician badges in', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'T1', person_name: 'Tech A', role: 'technician', technician_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'open', technician_badge_id: null }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'in_progress' }] }); // UPDATE

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'T1', reader_key: 'press-1' });
    expect(res.body.action).toBe('call_acknowledged');
    expect(res.body.call.status).toBe('in_progress');
  });

  it('returns no_active_call when a technician badges in with no active call', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'T1', person_name: 'Tech A', role: 'technician', technician_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'T1', reader_key: 'press-1' });
    expect(res.body.action).toBe('no_active_call');
  });

  it('resumes a suspended call when a technician badges in', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'T1', person_name: 'Tech A', role: 'technician', technician_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'suspended' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'in_progress' }] });

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'T1', reader_key: 'press-1' });
    expect(res.body.action).toBe('call_resumed');
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db is down'));
    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'press-1' });
    expect(res.status).toBe(500);
  });
});

describe('PUT /:id/resolve', () => {
  it('returns 400 when resolution_notes is missing', async () => {
    const res = await request(app).put('/1/resolve').send({ reason_category: 'mechanical' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when resolution_notes is only whitespace', async () => {
    const res = await request(app).put('/1/resolve').send({ resolution_notes: '   ' });
    expect(res.status).toBe(400);
  });

  it('resolves the call and returns the updated row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ call_id: 1, status: 'resolved' }] });
    const res = await request(app).put('/1/resolve').send({ resolution_notes: 'Fixed belt' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
  });

  it('returns 404 when the call is not found or already resolved', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/1/resolve').send({ resolution_notes: 'Fixed' });
    expect(res.status).toBe(404);
  });
});

describe('GET /active', () => {
  it('returns the active calls list', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ call_id: 1, status: 'open', machine_name: 'Press 701', seconds_since_called: 42 }],
    });
    const res = await request(app).get('/active');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].call_id).toBe(1);
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db is down'));
    const res = await request(app).get('/active');
    expect(res.status).toBe(500);
  });
});

describe('GET /parts/search', () => {
  it('returns an empty array for an empty query without hitting the database', async () => {
    const res = await request(app).get('/parts/search?q=');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns parts matching the search term', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ part_id: 1, name: 'Bearing', manufacturer_part_number: 'B-42', quantity: 5 }],
    });
    const res = await request(app).get('/parts/search?q=Bearing');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Bearing');
  });
});

describe('GET /board-status', () => {
  it('returns one row per machine with derived status', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { machine_id: 1, name: 'Press 1', status: 'running', queue_position: null },
        { machine_id: 2, name: 'Press 2', status: 'wait', call_id: 7, queue_position: 1 },
        { machine_id: 3, name: 'Press 3', status: 'pm', pm_id: 12, queue_position: null },
      ],
    });
    const res = await request(app).get('/board-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].status).toBe('running');
    expect(res.body[1].status).toBe('wait');
    expect(res.body[2].status).toBe('pm');
  });

  it('passes queue_position through for WAIT tiles', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { machine_id: 1, name: 'A', status: 'wait', queue_position: 2 },
        { machine_id: 2, name: 'B', status: 'wait', queue_position: 1 },
        { machine_id: 3, name: 'C', status: 'running', queue_position: null },
      ],
    });
    const res = await request(app).get('/board-status');
    const a = res.body.find((r) => r.machine_id === 1);
    const b = res.body.find((r) => r.machine_id === 2);
    const c = res.body.find((r) => r.machine_id === 3);
    expect(a.queue_position).toBe(2);
    expect(b.queue_position).toBe(1);
    expect(c.queue_position).toBeNull();
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/board-status');
    expect(res.status).toBe(500);
  });
});

describe('PUT /:id/resume', () => {
  it('returns 400 when id is not a positive integer', async () => {
    const res = await request(app).put('/abc/resume').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('flips a suspended call back to in_progress', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ call_id: 99, status: 'in_progress', suspended_at: null }],
    });
    const res = await request(app).put('/99/resume').send({});
    expect(res.status).toBe(200);
    expect(res.body.call_id).toBe(99);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 404 when the call is not suspended', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/99/resume').send({});
    expect(res.status).toBe(404);
  });
});

describe('GET /stats/parts-metrics', () => {
  it('returns top_parts, by_machine, and by_tech arrays', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ part_id: 1, part_name: 'Bearing 6205', part_number: 'B-6205', total_qty: 5, call_count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ machine_id: 125, machine_name: 'Die Press 701', unique_parts: 3, total_qty: 8 }] })
      .mockResolvedValueOnce({ rows: [{ technician_id: 1, technician_name: 'John D.', calls_with_parts: 4, unique_parts: 2, total_qty: 7 }] });

    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(200);
    expect(res.body.top_parts[0].part_name).toBe('Bearing 6205');
    expect(res.body.by_machine[0].machine_name).toBe('Die Press 701');
    expect(res.body.by_tech[0].technician_name).toBe('John D.');
  });

  it('returns empty arrays when no parts have been logged', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(200);
    expect(res.body.top_parts).toEqual([]);
    expect(res.body.by_machine).toEqual([]);
    expect(res.body.by_tech).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db is down'));
    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(500);
  });
});

describe('GET /stats/metrics — new fields', () => {
  // Helper: mock all 8 parallel queries in callMetrics order:
  // [overall, openCount, byMachine, byReason, byShift, byTech, trend, repeats]
  const mockAllMetrics = ({
    overrideOverall = {},
    overrideTech = [],
    overrideRepeats = [],
  } = {}) => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total_calls: '10', avg_response_minutes: '5', avg_repair_minutes: '30', avg_downtime_minutes: '35', total_downtime_hours: '6', total_downtime_cost: '1200', sla_pct: '90', critical_calls: '3', ...overrideOverall }] })
      .mockResolvedValueOnce({ rows: [{ open_calls: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: overrideTech })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: overrideRepeats });
  };

  it('overall includes critical_calls', async () => {
    mockAllMetrics({ overrideOverall: { critical_calls: '7' } });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.overall.critical_calls)).toBe(7);
  });

  it('by_tech includes suspensions per technician', async () => {
    mockAllMetrics({
      overrideTech: [{ technician_id: 1, technician_name: 'John D.', call_count: '8', avg_response_minutes: '6', avg_repair_minutes: '30', sla_pct: '87', suspensions: '3' }],
    });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.by_tech[0].suspensions)).toBe(3);
  });

  it('repeat_failures includes suspensions per machine+reason combo', async () => {
    mockAllMetrics({
      overrideRepeats: [{ machine_id: 125, machine_name: 'Die Press 701', reason_category: 'mechanical', occurrences: '5', suspensions: '2' }],
    });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.repeat_failures[0].suspensions)).toBe(2);
  });
});
