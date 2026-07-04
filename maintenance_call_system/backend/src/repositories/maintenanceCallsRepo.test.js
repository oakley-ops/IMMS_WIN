import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
const repo = require('./maintenanceCallsRepo');

describe('insertCallParts', () => {
  let client;

  beforeEach(() => {
    client = { query: vi.fn(), release: vi.fn() };
    db.getClient = vi.fn().mockResolvedValue(client);
  });

  it('wraps all inserts in a single transaction and returns the inserted rows', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ call_id: 1, part_id: 10, quantity: 2 }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 1, part_id: 11, quantity: 1 }] })
      .mockResolvedValueOnce({}); // COMMIT

    const parts = [
      { part_id: 10, part_name: 'Bearing', part_number: 'B-1', quantity: 2 },
      { part_id: 11, part_name: 'Belt', part_number: 'BL-1', quantity: 1 },
    ];
    const rows = await repo.insertCallParts(db, 1, parts);

    expect(rows).toEqual([
      { call_id: 1, part_id: 10, quantity: 2 },
      { call_id: 1, part_id: 11, quantity: 1 },
    ]);
    expect(client.query.mock.calls[0][0]).toBe('BEGIN');
    expect(client.query.mock.calls[client.query.mock.calls.length - 1][0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client if any insert fails', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('constraint violation'))
      .mockResolvedValueOnce({}); // ROLLBACK

    const parts = [{ part_id: 10, part_name: 'Bearing', part_number: 'B-1', quantity: 2 }];

    await expect(repo.insertCallParts(db, 1, parts)).rejects.toThrow('constraint violation');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('defaults quantity to 1 when not provided', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ call_id: 1, part_id: 10, quantity: 1 }] })
      .mockResolvedValueOnce({}); // COMMIT

    await repo.insertCallParts(db, 1, [{ part_id: 10, part_name: 'Bearing', part_number: 'B-1' }]);

    const insertCall = client.query.mock.calls[1];
    expect(insertCall[1]).toEqual([1, 10, 'Bearing', 'B-1', 1]);
  });
});
