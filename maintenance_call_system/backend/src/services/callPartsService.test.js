import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock does not intercept relative-path CJS require() in this vitest
// setup (see routes/maintenanceCalls.test.js), so replace the function
// directly on the shared, cached module object instead.
const repo = require('../repositories/maintenanceCallsRepo');
const { logCallParts } = require('./callPartsService');

const db = {};

describe('logCallParts', () => {
  beforeEach(() => {
    repo.insertCallParts = vi.fn();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('records call parts and decrements inventory for every part on success', async () => {
    repo.insertCallParts.mockResolvedValue([
      { call_id: 1, part_id: 10, quantity: 2 },
      { call_id: 1, part_id: 11, quantity: 1 },
    ]);
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const parts = [
      { part_id: 10, part_name: 'Bearing', part_number: 'B-1', quantity: 2 },
      { part_id: 11, part_name: 'Belt', part_number: 'BL-1', quantity: 1 },
    ];
    const result = await logCallParts(db, 1, parts);

    expect(repo.insertCallParts).toHaveBeenCalledWith(db, 1, parts);
    expect(result.parts).toHaveLength(2);
    expect(result.inventory).toEqual([
      { part_id: 10, decremented: true },
      { part_id: 11, decremented: true },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/parts/usage');
    expect(JSON.parse(options.body)).toMatchObject({ part_id: 10, quantity: 2, work_order_number: 'MC-1' });
  });

  it('marks a part as not decremented when IMMS reports insufficient quantity, but still keeps the logged part', async () => {
    repo.insertCallParts.mockResolvedValue([{ call_id: 1, part_id: 10, quantity: 5 }]);
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Insufficient quantity', available: 2, requested: 5 }),
    });

    const result = await logCallParts(db, 1, [{ part_id: 10, part_name: 'Bearing', part_number: 'B-1', quantity: 5 }]);

    expect(result.parts).toHaveLength(1);
    expect(result.inventory).toEqual([{ part_id: 10, decremented: false, error: 'Insufficient quantity' }]);
  });

  it('marks a part as not decremented when IMMS is unreachable, without failing the request', async () => {
    repo.insertCallParts.mockResolvedValue([{ call_id: 1, part_id: 10, quantity: 1 }]);
    global.fetch.mockRejectedValue(new Error('fetch failed'));

    const result = await logCallParts(db, 1, [{ part_id: 10, part_name: 'Bearing', part_number: 'B-1', quantity: 1 }]);

    expect(result.parts).toHaveLength(1);
    expect(result.inventory).toEqual([{ part_id: 10, decremented: false, error: 'fetch failed' }]);
  });

  it('defaults quantity to 1 when calling IMMS if the part has no quantity', async () => {
    repo.insertCallParts.mockResolvedValue([{ call_id: 1, part_id: 10, quantity: 1 }]);
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await logCallParts(db, 1, [{ part_id: 10, part_name: 'Bearing', part_number: 'B-1' }]);

    const [, options] = global.fetch.mock.calls[0];
    expect(JSON.parse(options.body).quantity).toBe(1);
  });
});
