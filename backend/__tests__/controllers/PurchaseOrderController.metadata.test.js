// Unit tests for the PO metadata-storage refactor: metadata now lives in real
// columns instead of being encoded into the notes field. The database is
// mocked (pool/client), so these verify the controller's read/write logic, not
// the SQL-vs-schema contract (that needs `npm run migrate` + a live DB).

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

jest.mock('../../src/services/PODocumentService');

const PurchaseOrderController = require('../../src/controllers/PurchaseOrderController');
const { validationResult } = require('express-validator');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe('PurchaseOrderController — metadata stored in columns, not notes', () => {
  let controller;
  let mockPool;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });

    mockPool = { query: jest.fn(), connect: jest.fn() };
    controller = new PurchaseOrderController();
    controller.pool = mockPool;
    res = makeRes();
  });

  describe('getPurchaseOrderById reads columns and decodes legacy notes', () => {
    // Returns the object passed to res.json() for a given purchase_orders row.
    const fetchPo = async (poRow) => {
      mockPool.query.mockImplementation((q) =>
        typeof q === 'string' && q.includes('FROM purchase_order_items')
          ? Promise.resolve({ rows: [] })
          : Promise.resolve({ rows: [poRow] })
      );
      await controller.getPurchaseOrderById({ params: { id: '7' } }, res);
      return res.json.mock.calls[0][0];
    };

    it('decodes the legacy JSON-blob notes written by old blank POs', async () => {
      // Arrange: columns at defaults, metadata only in the JSON notes blob.
      const out = await fetchPo({
        po_id: 7,
        supplier_name: null,
        is_urgent: false,
        next_day_air: false,
        priority: 'normal',
        shipping_cost: '0.00',
        tax_amount: '0.00',
        requested_by: null,
        approved_by: null,
        notes: JSON.stringify({
          original_notes: 'please rush',
          is_urgent: true,
          next_day_air: true,
          shipping_cost: 12.5,
          tax_amount: 3,
          requested_by: 'Bob',
          approved_by: 'Sue',
          manual_supplier_name: 'Acme Bolts',
        }),
      });

      // Assert: the blob is unpacked and notes is reduced to the user's text.
      expect(out.is_urgent).toBe(true);
      expect(out.next_day_air).toBe(true);
      expect(out.priority).toBe('urgent');
      expect(Number(out.shipping_cost)).toBe(12.5);
      expect(Number(out.tax_amount)).toBe(3);
      expect(out.requested_by).toBe('Bob');
      expect(out.approved_by).toBe('Sue');
      expect(out.supplier_name).toBe('Acme Bolts');
      expect(out.notes).toBe('please rush');
    });

    it('decodes legacy [TAG] notes and strips the markers from the text', async () => {
      const out = await fetchPo({
        po_id: 7,
        supplier_name: 'Real Supplier',
        is_urgent: false,
        next_day_air: false,
        priority: 'normal',
        shipping_cost: '0.00',
        tax_amount: '0.00',
        notes: '[PRIORITY: urgent] [SHIPPING: nextday] [SHIPPING_COST: 5.00] [TAX_AMOUNT: 1.50] handle with care',
      });

      expect(out.is_urgent).toBe(true);
      expect(out.next_day_air).toBe(true);
      expect(Number(out.shipping_cost)).toBe(5);
      expect(Number(out.tax_amount)).toBe(1.5);
      expect(out.notes).toBe('handle with care');
    });

    it('passes through new-style rows (columns set, plain notes) untouched', async () => {
      const out = await fetchPo({
        po_id: 7,
        supplier_name: 'Real Supplier',
        is_urgent: true,
        next_day_air: false,
        priority: 'urgent',
        shipping_cost: '10.00',
        tax_amount: '2.00',
        notes: 'just a normal note',
      });

      expect(out.is_urgent).toBe(true);
      expect(out.supplier_name).toBe('Real Supplier');
      expect(out.notes).toBe('just a normal note');
      expect(Number(out.shipping_cost)).toBe(10);
    });
  });

  describe('createBlankPurchaseOrder writes real columns', () => {
    it('persists metadata to columns and keeps notes as plain text', async () => {
      // Arrange: a manual PO (no supplier_id, free-text supplier name).
      const client = { query: jest.fn(), release: jest.fn() };
      client.query.mockImplementation((q) => {
        if (typeof q === 'string' && q.includes('SELECT po_number')) return Promise.resolve({ rows: [] });
        if (typeof q === 'string' && q.includes('INSERT INTO purchase_orders')) return Promise.resolve({ rows: [{ po_id: 42 }] });
        return Promise.resolve({ rows: [] });
      });
      mockPool.connect.mockResolvedValue(client);

      const req = {
        body: {
          manual_supplier_name: 'Manual Co',
          notes: 'hi there',
          is_urgent: true,
          next_day_air: false,
          shipping_cost: 9.99,
          tax_amount: 2,
          requested_by: 'R',
          approved_by: 'A',
        },
      };

      // Act
      await controller.createBlankPurchaseOrder(req, res);

      // Assert: the INSERT targets the real columns with the supplied values...
      const insert = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_orders')
      );
      expect(insert).toBeDefined();
      const [sql, params] = insert;
      expect(sql).toMatch(/manual_supplier_name/);
      expect(sql).toMatch(/is_urgent/);
      expect(sql).toMatch(/shipping_cost/);
      expect(params).toContain('Manual Co');
      expect(params).toContain('hi there'); // notes is the plain text
      expect(params).toContain('urgent');   // priority stays consistent with is_urgent
      // ...and NOT the old JSON blob.
      expect(params.some((p) => typeof p === 'string' && p.includes('original_notes'))).toBe(false);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updatePurchaseOrder writes columns, not notes tags', () => {
    it('updates priority/shipping columns and leaves notes plain', async () => {
      // Arrange
      mockPool.query.mockImplementation((q) => {
        if (typeof q === 'string' && q.includes('UPDATE purchase_orders')) {
          return Promise.resolve({ rows: [{ po_id: 123 }] });
        }
        if (typeof q === 'string' && q.includes('SELECT * FROM purchase_orders')) {
          return Promise.resolve({ rows: [{ po_id: 123, notes: 'existing note' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const req = {
        params: { id: '123' },
        body: { is_urgent: true, priority: 'urgent', next_day_air: true, shipping_cost: 5 },
      };

      // Act
      await controller.updatePurchaseOrder(req, res);

      // Assert
      const update = mockPool.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('UPDATE purchase_orders')
      );
      expect(update).toBeDefined();
      const [sql, params] = update;
      expect(sql).toMatch(/is_urgent = \$/);
      expect(sql).toMatch(/next_day_air = \$/);
      expect(sql).toMatch(/priority = \$/);
      expect(sql).toMatch(/shipping_cost = \$/);
      expect(params).toContain(true);            // is_urgent
      expect(params).toContain('urgent');        // priority
      expect(params).toContain('existing note'); // notes preserved verbatim
      expect(params.some((p) => typeof p === 'string' && p.includes('[PRIORITY:'))).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
