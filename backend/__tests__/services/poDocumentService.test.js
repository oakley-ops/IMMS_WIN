const PODocumentService = require('../../src/services/PODocumentService');
const path = require('path');
const fs = require('fs');

// Mock dependencies
jest.mock('../../src/utils/pdfGenerator', () => ({
  generatePurchaseOrderPDF: jest.fn().mockResolvedValue(Buffer.from('test pdf content'))
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('File not found')),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('test pdf content'))
  }
}));

describe('PO Document Service', () => {
  let poDocumentService;
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    poDocumentService = new PODocumentService(mockPool);
    
    // Adjust the document directory for testing
    poDocumentService.documentDir = path.join(process.cwd(), 'test-uploads', 'po_documents');
  });

  test('should create document directory if not exists', async () => {
    await poDocumentService.ensureDocumentDirectory();
    expect(fs.promises.mkdir).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true }
    );
  });

  test('should generate receipt document for PO', async () => {
    const mockPO = {
      po_id: 123,
      po_number: 'PO-2023-001',
      status: 'received',
      items: [],
      supplier_name: 'Test Supplier'
    };
    const mockUser = 'test-user';
    
    mockPool.query.mockResolvedValueOnce({ 
      rows: [{
        document_id: 1,
        po_id: 123,
        file_path: '/test/path/PO-2023-001-receipt.pdf',
        file_name: 'PO-2023-001-receipt.pdf',
        document_type: 'receipt'
      }] 
    });
    
    const result = await poDocumentService.generateReceiptDocument(mockPO, mockUser);
    
    // Test the result
    expect(result).toHaveProperty('document_id');
    expect(result.po_id).toBe(123);
    expect(result.document_type).toBe('receipt');
    
    // Test the file operations
    expect(fs.promises.mkdir).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('PO-2023-001-receipt'),
      expect.any(Buffer)
    );
    
    // Test the database operation
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO purchase_order_documents'),
      expect.arrayContaining([123, expect.any(String), expect.any(String), 'receipt', 'test-user'])
    );
  });

  test('should handle errors in document generation', async () => {
    const mockPO = {
      po_id: 123,
      po_number: 'PO-2023-001',
      status: 'received'
    };
    
    // Mock an error during file write
    fs.promises.writeFile.mockRejectedValueOnce(new Error('Disk full'));
    
    await expect(
      poDocumentService.generateReceiptDocument(mockPO, 'test-user')
    ).rejects.toThrow('Failed to generate receipt document');
  });

  test('should get documents for PO', async () => {
    const mockDocuments = [
      { document_id: 1, po_id: 123, file_name: 'test1.pdf' },
      { document_id: 2, po_id: 123, file_name: 'test2.pdf' }
    ];
    
    mockPool.query.mockResolvedValueOnce({ rows: mockDocuments });
    
    const results = await poDocumentService.getDocumentsByPOId(123);
    
    expect(results.length).toBe(2);
    expect(results[0].document_id).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM purchase_order_documents'),
      [123]
    );
  });

  test('should get document by ID', async () => {
    const mockDocument = { 
      document_id: 1, 
      po_id: 123, 
      file_name: 'test1.pdf',
      file_path: '/test/path/test1.pdf'
    };
    
    mockPool.query.mockResolvedValueOnce({ rows: [mockDocument] });
    
    const result = await poDocumentService.getDocumentById(1);
    
    expect(result.document_id).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM purchase_order_documents'),
      [1]
    );
  });

  test('should throw error if document not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    
    await expect(
      poDocumentService.getDocumentById(999)
    ).rejects.toThrow('Document not found');
  });

  test('should get document content', async () => {
    const mockDocument = { 
      document_id: 1, 
      po_id: 123, 
      file_name: 'test1.pdf',
      file_path: '/test/path/test1.pdf'
    };
    
    mockPool.query.mockResolvedValueOnce({ rows: [mockDocument] });
    
    const content = await poDocumentService.getDocumentContent(1);
    
    expect(content).toEqual(Buffer.from('test pdf content'));
    expect(fs.promises.readFile).toHaveBeenCalledWith('/test/path/test1.pdf');
  });
}); 