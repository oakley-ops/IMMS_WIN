const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Mock the database
const mockPool = {
  query: jest.fn()
};

// Mock app with dependency injection
jest.mock('../../src/config/db', () => ({ pool: mockPool }));

// Import the app after mocking the database
const app = require('../../src/app');

describe('Purchase Order Document API', () => {
  let authToken;
  
  beforeAll(() => {
    // Create test token
    authToken = jwt.sign(
      { userId: 1, username: 'testuser', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock directory and file for document storage/retrieval tests
    const testDocDir = path.join(process.cwd(), 'uploads', 'po_documents');
    if (!fs.existsSync(testDocDir)) {
      fs.mkdirSync(testDocDir, { recursive: true });
    }
    
    // Create a mock PDF file for testing
    const testFilePath = path.join(testDocDir, 'test-po-999-receipt.pdf');
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, Buffer.from('test PDF content'));
    }
  });
  
  test('should update status to received and generate document', async () => {
    // Mock purchase order data
    mockPool.query.mockImplementation((query, values) => {
      if (query.includes('UPDATE purchase_orders')) {
        return { rows: [{ po_id: 999, status: 'received', po_number: 'PO-TEST-999' }] };
      } else if (query.includes('SELECT * FROM purchase_orders')) {
        return {
          rows: [{
            po_id: 999,
            po_number: 'PO-TEST-999',
            status: 'received',
            supplier_name: 'Test Supplier',
            items: []
          }]
        };
      } else if (query.includes('INSERT INTO purchase_order_documents')) {
        return { 
          rows: [{
            document_id: 1,
            po_id: 999,
            file_path: path.join(process.cwd(), 'uploads', 'po_documents', 'test-po-999-receipt.pdf'),
            file_name: 'test-po-999-receipt.pdf',
            document_type: 'receipt'
          }]
        };
      }
      return { rows: [] };
    });

    const response = await request(app)
      .put('/api/v1/purchase-orders/999/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'received' })
      .expect(200);
      
    expect(response.body.status).toBe('received');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE purchase_orders'),
      expect.arrayContaining(['received', 999])
    );
  });
  
  test('should get documents for a purchase order', async () => {
    // Mock document retrieval
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          document_id: 1,
          po_id: 999,
          file_name: 'test-po-999-receipt.pdf',
          document_type: 'receipt',
          created_at: new Date().toISOString()
        }
      ]
    });
    
    const response = await request(app)
      .get('/api/v1/purchase-orders/999/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
      
    expect(response.body.length).toBe(1);
    expect(response.body[0].document_type).toBe('receipt');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM purchase_order_documents'),
      [999]
    );
  });
  
  test('should handle errors when getting documents', async () => {
    // Mock database error
    mockPool.query.mockRejectedValueOnce(new Error('Database error'));
    
    const response = await request(app)
      .get('/api/v1/purchase-orders/999/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(500);
      
    expect(response.body).toHaveProperty('error');
  });
  
  test('should download document', async () => {
    // Mock document retrieval
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        document_id: 1,
        po_id: 999,
        file_name: 'test-po-999-receipt.pdf',
        file_path: path.join(process.cwd(), 'uploads', 'po_documents', 'test-po-999-receipt.pdf'),
        document_type: 'receipt'
      }]
    });
    
    const response = await request(app)
      .get('/api/v1/purchase-orders/documents/1/download')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
      
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body.toString()).toBe('test PDF content');
  });
  
  test('should handle document not found', async () => {
    // Mock empty result
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    
    const response = await request(app)
      .get('/api/v1/purchase-orders/documents/999/download')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
      
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
  });
}); 