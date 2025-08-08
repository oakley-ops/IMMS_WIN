const fs = require('fs').promises;
const path = require('path');
const { extractTextFromPDF } = require('../utils/pdfExtractor');

/**
 * Service for managing machine documents
 */
class MachineDocumentService {
  constructor(pool) {
    this.pool = pool;
    this.documentDir = path.join(process.cwd(), 'uploads', 'machine_documents');
  }

  /**
   * Ensure the document directory exists
   */
  async ensureDocumentDirectory() {
    try {
      await fs.mkdir(this.documentDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
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
        'UPDATE machine_documents SET text_content = $1 WHERE document_id = $2',
        [textContent, documentId]
      );
      
      console.log(`Text content extracted and stored for document ID: ${documentId}`);
    } catch (error) {
      console.error(`Error extracting text from PDF: ${error.message}`);
      // Don't throw the error, as we don't want to fail the document upload if text extraction fails
    }
  }

  /**
   * Upload a document for a machine
   * @param {number} machineId - The machine ID
   * @param {Object} file - The uploaded file information
   * @param {string} username - The user uploading the document
   * @param {string} category - Document category
   * @param {string} title - Document title
   * @param {string} description - Document description
   * @returns {Promise<Object>} - The created document record
   */
  async uploadDocument(machineId, file, username, category = 'other', title = '', description = '') {
    try {
      // Ensure directory exists
      await this.ensureDocumentDirectory();
      
      // Create machine-specific subdirectory
      const machineDir = path.join(this.documentDir, `machine-${machineId}`);
      await fs.mkdir(machineDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = path.extname(file.originalname);
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${category}-${timestamp}-${sanitizedOriginalName}`;
      const finalPath = path.join(machineDir, filename);

      // Move file to final location
      await fs.rename(file.path, finalPath);
      
      // Get file stats
      const stats = await fs.stat(finalPath);
      
      // Save record in database
      const result = await this.pool.query(
        `INSERT INTO machine_documents 
         (machine_id, file_path, file_name, document_type, document_category, title, description, created_by, file_size, mime_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING *`,
        [
          machineId,
          finalPath,
          filename,
          fileExt.toLowerCase().substring(1) || 'unknown',
          category,
          title || file.originalname,
          description || `${category} document uploaded on ${new Date().toISOString()}`,
          username,
          stats.size,
          file.mimetype
        ]
      );

      const document = result.rows[0];
      
      // Extract and store text content if it's a PDF
      if (file.mimetype === 'application/pdf') {
        await this.extractAndStoreTextContent(document.document_id, finalPath);
      }

      return document;
    } catch (error) {
      console.error('Error uploading machine document:', error);
      // Clean up file if it was moved
      if (file.path) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Get all documents for a machine
   * @param {number} machineId - The machine ID
   * @returns {Promise<Array>} - Array of document records
   */
  async getDocumentsByMachineId(machineId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          document_id,
          machine_id,
          file_name,
          document_type,
          document_category,
          title,
          description,
          created_at,
          created_by,
          file_size,
          mime_type
        FROM machine_documents 
        WHERE machine_id = $1 
        ORDER BY created_at DESC`,
        [machineId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching machine documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
  }

  /**
   * Get document by ID
   * @param {number} documentId - The document ID
   * @returns {Promise<Object>} - The document record
   */
  async getDocumentById(documentId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM machine_documents WHERE document_id = $1',
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
      
      console.log(`Attempting to read file at path: ${document.file_path}`);
      
      try {
        // Check if file exists
        await fs.access(document.file_path);
        console.log(`File exists at path: ${document.file_path}`);
        return await fs.readFile(document.file_path);
      } catch (accessError) {
        console.error(`File access error: ${accessError.message}`);
        throw new Error(`Document file not found`);
      }
    } catch (error) {
      console.error('Error reading document file:', error);
      throw new Error(`Failed to read document file: ${error.message}`);
    }
  }

  /**
   * Delete a document
   * @param {number} documentId - The document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(documentId) {
    try {
      // Get document info first
      const document = await this.getDocumentById(documentId);
      
      // Delete file from filesystem
      try {
        await fs.unlink(document.file_path);
        console.log(`Deleted file: ${document.file_path}`);
      } catch (fileError) {
        console.warn(`Could not delete file: ${document.file_path}`, fileError.message);
        // Continue with database deletion even if file deletion fails
      }
      
      // Delete from database
      await this.pool.query(
        'DELETE FROM machine_documents WHERE document_id = $1',
        [documentId]
      );
      
      console.log(`Document ${documentId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Update document metadata
   * @param {number} documentId - The document ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - The updated document record
   */
  async updateDocument(documentId, updates) {
    try {
      const { title, description, document_category } = updates;
      
      const result = await this.pool.query(
        `UPDATE machine_documents 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             document_category = COALESCE($3, document_category)
         WHERE document_id = $4 
         RETURNING *`,
        [title, description, document_category, documentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating document:', error);
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Search documents by text content
   * @param {number} machineId - The machine ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching documents
   */
  async searchDocuments(machineId, searchTerm) {
    try {
      const result = await this.pool.query(
        `SELECT 
          document_id,
          machine_id,
          file_name,
          document_type,
          document_category,
          title,
          description,
          created_at,
          created_by,
          file_size,
          mime_type
        FROM machine_documents 
        WHERE machine_id = $1 
        AND (
          title ILIKE $2 OR 
          description ILIKE $2 OR 
          text_content ILIKE $2 OR
          file_name ILIKE $2
        )
        ORDER BY created_at DESC`,
        [machineId, `%${searchTerm}%`]
      );
      return result.rows;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw new Error(`Failed to search documents: ${error.message}`);
    }
  }
}

module.exports = MachineDocumentService; 