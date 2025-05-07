const fs = require('fs').promises;
const path = require('path');
const { generatePurchaseOrderPDF } = require('../utils/pdfGenerator');
const { extractTextFromPDF } = require('../utils/pdfExtractor');

/**
 * Service for managing purchase order documents
 */
class PODocumentService {
  constructor(pool) {
    this.pool = pool;
    this.documentDir = path.join(process.cwd(), 'uploads', 'po_documents');
  }

  /**
   * Ensure the document directory exists
   */
  async ensureDocumentDirectory() {
    try {
      await fs.access(this.documentDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.documentDir, { recursive: true });
    }
  }

  /**
   * Extract and store text content from a PDF file
   * @param {number} documentId - The document ID
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<void>}
   */
  async extractAndStoreTextContent(documentId, filePath) {
    try {
      // Only process PDF files
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        console.log(`Skipping text extraction for non-PDF file: ${filePath}`);
        return;
      }

      console.log(`Extracting text from PDF: ${filePath}`);
      const textContent = await extractTextFromPDF(filePath);
      
      // Store the extracted text in the database
      await this.pool.query(
        'UPDATE purchase_order_documents SET text_content = $1 WHERE document_id = $2',
        [textContent, documentId]
      );
      
      console.log(`Text content extracted and stored for document ID: ${documentId}`);
    } catch (error) {
      console.error(`Error extracting text from PDF: ${error.message}`);
      // Don't throw the error, as we don't want to fail the document upload if text extraction fails
    }
  }

  /**
   * Generate a receipt document for a purchase order
   * @param {Object} purchaseOrder - The purchase order object
   * @param {string} username - The user generating the document
   * @returns {Promise<Object>} - The created document record
   */
  async generateReceiptDocument(purchaseOrder, username) {
    try {
      // Ensure directory exists
      await this.ensureDocumentDirectory();

      const { po_id, po_number } = purchaseOrder;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `PO-${po_number}-receipt-${timestamp}.pdf`;
      // Use absolute path for storage to ensure it can be found later
      const filePath = path.resolve(this.documentDir, fileName);

      // Generate PDF
      const pdfBuffer = await generatePurchaseOrderPDF(purchaseOrder, true);
      
      // Write to file
      await fs.writeFile(filePath, pdfBuffer);

      // Save record in database
      const result = await this.pool.query(
        `INSERT INTO purchase_order_documents 
         (po_id, file_path, file_name, document_type, created_by, notes) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          po_id,
          filePath,
          fileName,
          'receipt',
          username,
          `Receipt document generated when PO was marked as received on ${new Date().toISOString()}`
        ]
      );

      const document = result.rows[0];
      
      // Extract and store text content
      await this.extractAndStoreTextContent(document.document_id, filePath);

      return document;
    } catch (error) {
      console.error('Error generating receipt document:', error);
      throw new Error(`Failed to generate receipt document: ${error.message}`);
    }
  }

  /**
   * Generate an approval document for a purchase order
   * @param {Object} purchaseOrder - The purchase order object
   * @param {string} username - The user approving the document
   * @returns {Promise<Object>} - The created document record
   */
  async generateApprovalDocument(purchaseOrder, username) {
    try {
      // Ensure directory exists
      await this.ensureDocumentDirectory();

      const { po_id, po_number } = purchaseOrder;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `PO-${po_number}-approved-${timestamp}.pdf`;
      // Use absolute path for storage to ensure it can be found later
      const filePath = path.resolve(this.documentDir, fileName);

      // Generate PDF
      const pdfBuffer = await generatePurchaseOrderPDF(purchaseOrder, false);
      
      // Write to file
      await fs.writeFile(filePath, pdfBuffer);

      // Save record in database
      const result = await this.pool.query(
        `INSERT INTO purchase_order_documents 
         (po_id, file_path, file_name, document_type, created_by, notes) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          po_id,
          filePath,
          fileName,
          'approved',
          username,
          `Approval document generated when PO was approved on ${new Date().toISOString()}`
        ]
      );

      const document = result.rows[0];
      
      // Extract and store text content
      await this.extractAndStoreTextContent(document.document_id, filePath);

      return document;
    } catch (error) {
      console.error('Error generating approval document:', error);
      throw new Error(`Failed to generate approval document: ${error.message}`);
    }
  }

  /**
   * Get all documents for a purchase order
   * @param {number} poId - The purchase order ID
   * @returns {Promise<Array>} - The documents
   */
  async getDocumentsByPOId(poId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM purchase_order_documents WHERE po_id = $1 ORDER BY created_at DESC',
        [poId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching PO documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
  }

  /**
   * Get a document by ID
   * @param {number} documentId - The document ID
   * @returns {Promise<Object>} - The document
   */
  async getDocumentById(documentId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM purchase_order_documents WHERE document_id = $1',
        [documentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching document:', error);
      throw new Error(`Failed to fetch document: ${error.message}`);
    }
  }

  /**
   * Get document file content
   * @param {number} documentId - The document ID
   * @returns {Promise<Buffer>} - The file content
   */
  async getDocumentContent(documentId) {
    try {
      const document = await this.getDocumentById(documentId);
      
      // Add error logging for troubleshooting
      console.log(`Attempting to read file at path: ${document.file_path}`);
      
      try {
        // Check if file exists
        await fs.access(document.file_path);
        console.log(`File exists at path: ${document.file_path}`);
      } catch (accessError) {
        console.error(`File access error: ${accessError.message}`);
        
        // Try alternative path construction if the stored path doesn't work
        const alternativePath = path.join(this.documentDir, document.file_name);
        console.log(`Trying alternative path: ${alternativePath}`);
        
        try {
          await fs.access(alternativePath);
          console.log(`File exists at alternative path: ${alternativePath}`);
          return await fs.readFile(alternativePath);
        } catch (altAccessError) {
          console.error(`Alternative path access error: ${altAccessError.message}`);
          throw new Error(`Document file not found at any location`);
        }
      }
      
      return await fs.readFile(document.file_path);
    } catch (error) {
      console.error('Error reading document file:', error);
      throw new Error(`Failed to read document file: ${error.message}`);
    }
  }

  /**
   * Delete a document by ID
   * @param {number} documentId - The document ID
   * @returns {Promise<Object>} - The deleted document information
   */
  async deleteDocument(documentId) {
    try {
      // First get the document to get the file path
      const document = await this.getDocumentById(documentId);
      
      // Delete the record from the database
      const result = await this.pool.query(
        'DELETE FROM purchase_order_documents WHERE document_id = $1 RETURNING *',
        [documentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Document not found or already deleted');
      }
      
      // Try to delete the physical file
      try {
        await fs.access(document.file_path);
        await fs.unlink(document.file_path);
        console.log(`File deleted at path: ${document.file_path}`);
      } catch (fileError) {
        // Check if file exists at alternative location
        const alternativePath = path.join(this.documentDir, document.file_name);
        try {
          await fs.access(alternativePath);
          await fs.unlink(alternativePath);
          console.log(`File deleted at alternative path: ${alternativePath}`);
        } catch (altFileError) {
          // Log error but don't fail if file not found - the database record is still deleted
          console.warn(`Could not delete file for document ${documentId}: ${altFileError.message}`);
        }
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Process uploaded document and extract text if it's a PDF
   * @param {number} poId - The purchase order ID
   * @param {Object} file - The uploaded file information
   * @param {string} username - The user uploading the document
   * @param {string} notes - Optional notes for the document
   * @returns {Promise<Object>} - The created document record
   */
  async uploadDocument(poId, file, username, notes = '') {
    try {
      // Ensure directory exists
      await this.ensureDocumentDirectory();
      
      // Save record in database
      const result = await this.pool.query(
        `INSERT INTO purchase_order_documents 
         (po_id, file_path, file_name, document_type, created_by, notes) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          poId,
          file.path,
          file.filename,
          path.extname(file.originalname).toLowerCase() === '.pdf' ? 'pdf' : 'other',
          username,
          notes || `Document uploaded on ${new Date().toISOString()}`
        ]
      );

      const document = result.rows[0];
      
      // Extract and store text content if it's a PDF
      if (path.extname(file.originalname).toLowerCase() === '.pdf') {
        await this.extractAndStoreTextContent(document.document_id, file.path);
      }

      return document;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Search for text within purchase order documents
   * @param {string} searchTerm - The term to search for
   * @returns {Promise<Array>} - Array of document IDs and PO IDs where the term was found
   */
  async searchDocumentsText(searchTerm) {
    try {
      // Use PostgreSQL full-text search to find matching documents
      const result = await this.pool.query(
        `SELECT doc.document_id, doc.po_id, po.po_number, po.supplier_id, s.name as supplier_name
         FROM purchase_order_documents doc
         JOIN purchase_orders po ON doc.po_id = po.po_id
         LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
         WHERE doc.search_vector @@ plainto_tsquery('english', $1)
         ORDER BY po.created_at DESC`,
        [searchTerm]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error searching document text:', error);
      throw new Error(`Failed to search document text: ${error.message}`);
    }
  }
}

module.exports = PODocumentService;