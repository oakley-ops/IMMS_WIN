const { statusFor, computeAlerts } = require('../../../src/services/notifications/alerts');
const { EVENTS } = require('../../../src/services/notifications/config');

describe('statusFor', () => {
  test('out when qty 0', () => expect(statusFor({ quantity: 0, minimum_quantity: 5 })).toBe('out_of_stock'));
  test('low when qty <= min and > 0', () => expect(statusFor({ quantity: 2, minimum_quantity: 2 })).toBe('low_stock'));
  test('in_stock when qty > min', () => expect(statusFor({ quantity: 3, minimum_quantity: 2 })).toBe('in_stock'));
});

describe('computeAlerts', () => {
  const parts = [
    { part_id: 1, quantity: 2, minimum_quantity: 2 }, // in_stock -> low  => fire low
    { part_id: 2, quantity: 0, minimum_quantity: 5 }, // low -> out       => fire out
    { part_id: 3, quantity: 2, minimum_quantity: 2 }, // low -> low       => silent
    { part_id: 4, quantity: 9, minimum_quantity: 2 }, // out -> in_stock  => silent
    { part_id: 5, quantity: 1, minimum_quantity: 5 }, // out -> low       => silent (improving)
  ];
  const prev = new Map([[2, 'low_stock'], [3, 'low_stock'], [4, 'out_of_stock'], [5, 'out_of_stock']]);

  test('fires only on worsening transitions', () => {
    const { events } = computeAlerts(parts, prev);
    expect(events).toEqual([
      { part: parts[0], eventType: EVENTS.INVENTORY_LOW },
      { part: parts[1], eventType: EVENTS.INVENTORY_OUT },
    ]);
  });

  test('returns new state for every part', () => {
    const { newStates } = computeAlerts(parts, prev);
    expect(newStates).toEqual([
      { part_id: 1, status: 'low_stock' },
      { part_id: 2, status: 'out_of_stock' },
      { part_id: 3, status: 'low_stock' },
      { part_id: 4, status: 'in_stock' },
      { part_id: 5, status: 'low_stock' },
    ]);
  });
});

const InventoryReconciler = require('../../../src/services/notifications/InventoryReconciler');

function reconcilerPool({ parts, state }) {
  const upserts = [];
  const pool = {
    query: jest.fn(async (text, params) => {
      if (/FROM parts/i.test(text)) return { rows: parts };
      if (/COUNT\(\*\)/i.test(text)) return { rows: [{ count: String(state.length) }] };
      if (/FROM part_alert_state/i.test(text)) return { rows: state };
      if (/INSERT INTO part_alert_state/i.test(text)) { upserts.push(params); return { rows: [] }; }
      return { rows: [] };
    }),
  };
  return { pool, upserts };
}

describe('InventoryReconciler', () => {
  test('reconcile fires notify on worsening transition and upserts state', async () => {
    const { pool, upserts } = reconcilerPool({
      parts: [{ part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2 }],
      state: [{ part_id: 1, last_status: 'in_stock' }],
    });
    const notify = jest.fn().mockResolvedValue();
    const r = new InventoryReconciler({ pool, notificationService: { notify } });
    await r.reconcile();
    expect(notify).toHaveBeenCalledWith('inventory.out', expect.objectContaining({ part_id: 1 }));
    expect(upserts).toEqual([[1, 'out_of_stock']]);
  });

  test('seedIfEmpty seeds silently when table empty', async () => {
    const { pool, upserts } = reconcilerPool({
      parts: [{ part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2 }],
      state: [],
    });
    const notify = jest.fn();
    const r = new InventoryReconciler({ pool, notificationService: { notify } });
    await r.seedIfEmpty();
    expect(notify).not.toHaveBeenCalled();      // seeding does not alert
    expect(upserts).toEqual([[1, 'out_of_stock']]);
  });
});
