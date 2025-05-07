// Mock database first before requiring any files that use it
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  }
}));

// Now we can safely import the controller
const PurchaseOrderController = require('../../src/controllers/PurchaseOrderController');
const PODocumentService = require('../../src/services/PODocumentService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

jest.mock('../../src/services/PODocumentService');

describe('Purchase Order Controller - Document Generation', () => {
  let purchaseOrderController;
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  };
  const mockReq = {};
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup PODocumentService mock
    PODocumentService.mockClear();
    PODocumentService.mockImplementation(() => ({
      generateReceiptDocument: jest.fn().mockResolvedValue({
        document_id: 1,
        file_path: '/test/path/PO-123-receipt.pdf'
      }),
      getDocumentsByPOId: jest.fn().mockResolvedValue([
        { document_id: 1, file_name: 'doc1.pdf' }
      ]),
      getDocumentContent: jest.fn().mockResolvedValue(Buffer.from('test content'))
    }));
    
    // Setup request mock
    mockReq.params = { id: '123' };
    mockReq.body = { status: 'received' };
    mockReq.user = { username: 'test-user' };
    
    // Setup validation mock
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
    
    // Setup response mock
    mockRes.status.mockClear();
    mockRes.json.mockClear();
    mockRes.send.mockClear();
    
    // Create controller instance and override the pool
    purchaseOrderController = new PurchaseOrderController();
    purchaseOrderController.pool = mockPool;
    purchaseOrderController.documentService = new PODocumentService();
    
    // Mock getPurchaseOrderWithItems method for testing
    purchaseOrderController.getPurchaseOrderWithItems = jest.fn().mockImplementation((poId) => {
      return Promise.resolve({
        po_id: poId,
        po_number: `PO-${poId}`,
        status: 'received',
        supplier_name: 'Test Supplier',
        items: []
      });
    });
  });

  test('should generate receipt document when PO status is changed to received', async () => {
    // Setup mocks for successful status update
    mockPool.query.mockImplementation((query, values) => {
      if (query.includes('UPDATE purchase_orders')) {
        return { rows: [{ po_id: 123, status: 'received', po_number: 'PO-123' }] };
      } else if (query.includes('SELECT * FROM purchase_orders')) {
        return { 
          rows: [{ 
            po_id: 123, 
            status: 'received', 
            po_number: 'PO-123',
            supplier_name: 'Test Supplier',
            items: []
          }] 
        };
      }
      return { rows: [] };
    });

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    expect(purchaseOrderController.documentService.generateReceiptDocument).toHaveBeenCalledWith(
      expect.objectContaining({ po_id: 123 }),
      'test-user'
    );
  });

  test('should not generate receipt document for non-received status', async () => {
    mockReq.body.status = 'approved';
    
    mockPool.query.mockImplementation((query) => {
      if (query.includes('UPDATE purchase_orders')) {
        return { rows: [{ po_id: 123, status: 'approved', po_number: 'PO-123' }] };
      }
      return { rows: [] };
    });

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    expect(purchaseOrderController.documentService.generateReceiptDocument).not.toHaveBeenCalled();
  });

  test('should handle errors in document generation', async () => {
    mockPool.query.mockImplementation((query) => {
      if (query.includes('UPDATE purchase_orders')) {
        return { rows: [{ po_id: 123, status: 'received', po_number: 'PO-123' }] };
      } else if (query.includes('SELECT * FROM purchase_orders')) {
        return { 
          rows: [{ 
            po_id: 123, 
            status: 'received', 
            po_number: 'PO-123',
            supplier_name: 'Test Supplier',
            items: []
          }] 
        };
      }
      return { rows: [] };
    });
    
    // Mock document service error
    purchaseOrderController.documentService.generateReceiptDocument.mockRejectedValueOnce(
      new Error('Document generation failed')
    );

    // Create a spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    // The status update should still succeed even if document generation fails
    expect(mockRes.json).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(500);
    
    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error generating receipt document'),
      expect.any(Error)
    );
    
    consoleErrorSpy.mockRestore();
  });

  test('should handle validation errors', async () => {
    // Mock validation errors
    validationResult.mockReturnValueOnce({
      isEmpty: jest.fn().mockReturnValue(false),
      array: jest.fn().mockReturnValue([{ msg: 'Status is required' }])
    });

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ errors: expect.any(Array) });
  });

  test('should handle PO not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  test('should handle database errors', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('Database error'));

    await purchaseOrderController.updatePurchaseOrderStatus(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
}); 