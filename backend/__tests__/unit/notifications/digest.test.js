const { buildDigest, sendDigest } = require('../../../src/services/notifications/digest');
const { EVENTS } = require('../../../src/services/notifications/config');

const rows = [
  { part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2, kind: 'out' },
  { part_id: 2, name: 'B', quantity: 1, minimum_quantity: 2, kind: 'low' },
];
const pool = { query: jest.fn().mockResolvedValue({ rows }) };

test('buildDigest splits out vs low', async () => {
  const d = await buildDigest(pool);
  expect(d.outParts).toHaveLength(1);
  expect(d.lowParts).toHaveLength(1);
});

test('sendDigest notifies when there is something', async () => {
  const service = { notify: jest.fn().mockResolvedValue() };
  await sendDigest(pool, service);
  expect(service.notify).toHaveBeenCalledWith(EVENTS.INVENTORY_DIGEST, expect.objectContaining({ outParts: expect.any(Array), lowParts: expect.any(Array) }));
});

test('sendDigest is silent when nothing is low/out', async () => {
  const emptyPool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = { notify: jest.fn() };
  await sendDigest(emptyPool, service);
  expect(service.notify).not.toHaveBeenCalled();
});
