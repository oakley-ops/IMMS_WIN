const fs = require('fs').promises;
const path = require('path');
const { extractTextFromPDF } = require('../utils/pdfExtractor');

class DieDocumentService {
  constructor(pool) {
    this.pool = pool;
    this.documentDir = path.join(process.cwd(), 'uploads', 'die_documents');
  }

  async ensureDocumentDirectory() {
    try {
      await fs.mkdir(this.documentDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async extractAndStoreTextContent(documentId, filePath) {
    try {
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        console.log(`Skipping text extraction for non-PDF file: ${filePath}`);
        return;
      }

      console.log(`Extracting text from PDF: ${filePath}`);
      const textContent = await extractTextFromPDF(filePath);
      
      await this.pool.query(
        'UPDATE die_documents SET text_content = $1 WHERE document_id = $2',
        [textContent, documentId]
      );
      
      console.log(`Text content extracted and stored for document ID: ${documentId}`);
    } catch (error) {
      console.error(`Error extracting text from PDF: ${error.message}`);
    }
  }

  async uploadDocument(dieId, file, username, category = 'other', title = '', description = '', sharpeningId = null, poNumber = null, documentDate = null) {
    try {
      await this.ensureDocumentDirectory();
      
      const dieDir = path.join(this.documentDir, `die-${dieId}`);
      await fs.mkdir(dieDir, { recursive: true });

      const timestamp = Date.now();
      const fileExt = path.extname(file.originalname);
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${category}-${timestamp}-${sanitizedOriginalName}`;
      const finalPath = path.join(dieDir, filename);

      await fs.rename(file.path, finalPath);
      
      const stats = await fs.stat(finalPath);
      
      const result = await this.pool.query(
        `INSERT INTO die_documents 
         (die_id, sharpening_id, file_path, file_name, document_type, document_category, 
          title, description, uploaded_by_name, file_size, mime_type, related_po_number, document_date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
         RETURNING *`,
        [
          dieId,
          sharpeningId,
          finalPath,
          file.originalname,
          fileExt.toLowerCase().substring(1) || 'unknown',
          category,
          title || file.originalname,
          description,
          username,
          stats.size,
          file.mimetype,
          poNumber,
          documentDate
        ]
      );

      const document = result.rows[0];

      if (finalPath.toLowerCase().endsWith('.pdf')) {
        this.extractAndStoreTextContent(document.document_id, finalPath).catch(err => {
          console.error('Background PDF text extraction failed:', err);
        });
      }

      return document;
    } catch (error) {
      console.error('Error uploading die document:', error);
      throw error;
    }
  }

  async getDocumentsByDie(dieId, category = null, sharpeningId = null) {
    try {
      let query = `
        SELECT 
          dd.*,
          d.die_number,
          d.die_name
        FROM die_documents dd
        JOIN dies d ON dd.die_id = d.die_id
        WHERE dd.die_id = $1
      `;
      
      const params = [dieId];
      let paramCount = 2;

      if (category) {
        query += ` AND dd.document_category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }

      if (sharpeningId) {
        query += ` AND dd.sharpening_id = $${paramCount}`;
        params.push(sharpeningId);
        paramCount++;
      }

      query += ` ORDER BY dd.created_at DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching die documents:', error);
      throw error;
    }
  }

  async getDocumentsBySharpening(sharpeningId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          dd.*,
          d.die_number,
          d.die_name
        FROM die_documents dd
        JOIN dies d ON dd.die_id = d.die_id
        WHERE dd.sharpening_id = $1
        ORDER BY dd.created_at DESC`,
        [sharpeningId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching sharpening documents:', error);
      throw error;
    }
  }

  async searchDocuments(searchQuery, dieId = null, category = null, startDate = null, endDate = null) {
    try {
      let query = `
        SELECT 
          dd.*,
          d.die_number,
          d.die_name,
          ts_rank(to_tsvector('english', COALESCE(dd.text_content, '')), plainto_tsquery('english', $1)) as relevance
        FROM die_documents dd
        JOIN dies d ON dd.die_id = d.die_id
        WHERE (
          to_tsvector('english', COALESCE(dd.text_content, '')) @@ plainto_tsquery('english', $1)
          OR dd.title ILIKE $2
          OR dd.description ILIKE $2
          OR dd.related_po_number ILIKE $2
        )
      `;

      const params = [searchQuery, `%${searchQuery}%`];
      let paramCount = 3;

      if (dieId) {
        query += ` AND dd.die_id = $${paramCount}`;
        params.push(dieId);
        paramCount++;
      }

      if (category) {
        query += ` AND dd.document_category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }

      if (startDate) {
        query += ` AND dd.document_date >= $${paramCount}`;
        params.push(startDate);
        paramCount++;
      }

      if (endDate) {
        query += ` AND dd.document_date <= $${paramCount}`;
        params.push(endDate);
        paramCount++;
      }

      query += ` ORDER BY relevance DESC, dd.created_at DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      const result = await this.pool.query(
        'SELECT file_path FROM die_documents WHERE document_id = $1',
        [documentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      const filePath = result.rows[0].file_path;

      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete file: ${filePath}`, error);
      }

      await this.pool.query(
        'DELETE FROM die_documents WHERE document_id = $1',
        [documentId]
      );

      return { success: true, message: 'Document deleted successfully' };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async getDocument(documentId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM die_documents WHERE document_id = $1',
        [documentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error;
    }
  }
}

module.exports = DieDocumentService;
