const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Setup test database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'test',
  password: process.env.DB_PASSWORD || 'test',
  database: process.env.DB_NAME || 'fiservinventory_test'
});

describe('Purchase Order Documents Schema', () => {
  beforeAll(async () => {
    // Create mock purchase_orders table if not exists for foreign key constraint
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        po_id SERIAL PRIMARY KEY,
        po_number VARCHAR(255),
        status VARCHAR(50)
      );
    `);

    // Execute schema creation script for testing
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../../../migrations/add_po_documents_table.sql'),
      'utf8'
    );
    await pool.query(schemaSQL);
  });

  afterAll(async () => {
    // Clean up the test database
    await pool.query('DROP TABLE IF EXISTS purchase_order_documents');
    await pool.query('DROP TABLE IF EXISTS purchase_orders');
    await pool.end();
  });

  test('should be able to create a document record', async () => {
    // First create a mock purchase order
    const poResult = await pool.query(`
      INSERT INTO purchase_orders (po_number, status) 
      VALUES ('PO-TEST-123', 'received')
      RETURNING po_id
    `);
    
    const poId = poResult.rows[0].po_id;

    // Now add a document record
    const result = await pool.query(`
      INSERT INTO purchase_order_documents 
      (po_id, file_path, file_name, created_by, document_type) 
      VALUES ($1, '/test/path', 'test-po-123.pdf', 'test-user', 'receipt')
      RETURNING *
    `, [poId]);
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].po_id).toBe(poId);
    expect(result.rows[0].file_name).toBe('test-po-123.pdf');
    expect(result.rows[0].document_type).toBe('receipt');
  });

  test('should fail if PO ID does not exist', async () => {
    // Try to add a document with non-existent PO ID
    try {
      await pool.query(`
        INSERT INTO purchase_order_documents 
        (po_id, file_path, file_name, created_by, document_type) 
        VALUES (99999, '/test/path', 'test-po-999.pdf', 'test-user', 'receipt')
      `);
      // Should not reach this point
      expect(true).toBe(false);
    } catch (error) {
      // Should throw a foreign key constraint error
      expect(error.message).toContain('foreign key constraint');
    }
  });

  test('should retrieve documents by PO ID', async () => {
    // Get the PO ID from the first test
    const poResult = await pool.query(`
      SELECT po_id FROM purchase_orders WHERE po_number = 'PO-TEST-123'
    `);
    
    const poId = poResult.rows[0].po_id;

    // Add another document to the same PO
    await pool.query(`
      INSERT INTO purchase_order_documents 
      (po_id, file_path, file_name, created_by, document_type) 
      VALUES ($1, '/test/path2', 'test-po-123-2.pdf', 'test-user', 'invoice')
    `, [poId]);

    // Query for all documents for this PO
    const result = await pool.query(`
      SELECT * FROM purchase_order_documents WHERE po_id = $1
    `, [poId]);

    expect(result.rows.length).toBe(2);
    expect(result.rows.map(doc => doc.document_type)).toContain('receipt');
    expect(result.rows.map(doc => doc.document_type)).toContain('invoice');
  });
}); 