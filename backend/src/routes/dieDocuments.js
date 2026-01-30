const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../../db');
const auth = require('../middleware/auth');
const DieDocumentService = require('../services/DieDocumentService');

const documentService = new DieDocumentService(pool);

// Allowed MIME types mapped to extensions for validation
const ALLOWED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
};

// Generate secure random filename to prevent path traversal attacks
const generateSecureFilename = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${randomName}${ext}`;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // SECURITY: Use secure random filename instead of original name
    cb(null, generateSecureFilename(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    // SECURITY: Validate both extension and MIME type strictly
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.docx', '.xlsx'];

    // Check extension
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('File extension not allowed. Only PDF, images, and document files are permitted.'));
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return cb(new Error('File type not allowed. Only PDF, images, and document files are permitted.'));
    }

    // Verify extension matches MIME type (prevent extension spoofing)
    const expectedExt = ALLOWED_MIME_TYPES[file.mimetype];
    if (ext !== expectedExt && !(ext === '.jpeg' && expectedExt === '.jpg')) {
      return cb(new Error('File extension does not match file type.'));
    }

    cb(null, true);
  }
});

router.post('/dies/:die_id/documents', auth, upload.single('file'), async (req, res) => {
  try {
    const { die_id } = req.params;
    const {
      document_category,
      title,
      description,
      sharpening_id,
      related_po_number,
      document_date
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await documentService.uploadDocument(
      die_id,
      req.file,
      req.user.username || req.user.name,
      document_category,
      title,
      description,
      sharpening_id,
      related_po_number,
      document_date
    );

    res.status(201).json({
      document_id: document.document_id,
      die_id: document.die_id,
      file_name: document.file_name,
      document_category: document.document_category,
      file_size: document.file_size,
      created_at: document.created_at,
      text_content_extracted: document.document_type === 'pdf'
    });
  } catch (error) {
    console.error('Error uploading die document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/dies/:die_id/documents', auth, async (req, res) => {
  try {
    const { die_id } = req.params;
    const { category, sharpening_id } = req.query;

    const documents = await documentService.getDocumentsByDie(
      die_id,
      category,
      sharpening_id
    );

    const formattedDocuments = documents.map(doc => ({
      document_id: doc.document_id,
      file_name: doc.file_name,
      document_category: doc.document_category,
      title: doc.title,
      description: doc.description,
      file_size: doc.file_size,
      related_po_number: doc.related_po_number,
      document_date: doc.document_date,
      created_at: doc.created_at,
      uploaded_by_name: doc.uploaded_by_name,
      download_url: `/api/v1/die-documents/documents/${doc.document_id}/download`
    }));

    res.json({
      documents: formattedDocuments,
      total: formattedDocuments.length
    });
  } catch (error) {
    console.error('Error fetching die documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/sharpening/:sharpening_id/documents', auth, upload.single('file'), async (req, res) => {
  try {
    const { sharpening_id } = req.params;
    const {
      document_category,
      title,
      description,
      related_po_number,
      document_date
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sharpeningResult = await pool.query(
      'SELECT die_id FROM die_sharpening_records WHERE sharpening_id = $1',
      [sharpening_id]
    );

    if (sharpeningResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sharpening record not found' });
    }

    const die_id = sharpeningResult.rows[0].die_id;

    const document = await documentService.uploadDocument(
      die_id,
      req.file,
      req.user.username || req.user.name,
      document_category,
      title,
      description,
      sharpening_id,
      related_po_number,
      document_date
    );

    res.status(201).json({
      document_id: document.document_id,
      die_id: document.die_id,
      sharpening_id: document.sharpening_id,
      file_name: document.file_name,
      document_category: document.document_category,
      file_size: document.file_size,
      created_at: document.created_at
    });
  } catch (error) {
    console.error('Error uploading sharpening document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/documents/:document_id/download', auth, async (req, res) => {
  try {
    const { document_id } = req.params;

    const document = await documentService.getDocument(document_id);

    res.download(document.file_path, document.file_name);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

router.delete('/documents/:document_id', auth, async (req, res) => {
  try {
    const { document_id } = req.params;

    await documentService.deleteDocument(document_id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.get('/dies/documents/search', auth, async (req, res) => {
  try {
    const { q, category, start_date, end_date, die_id } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const documents = await documentService.searchDocuments(
      q,
      die_id,
      category,
      start_date,
      end_date
    );

    res.json({
      results: documents,
      total: documents.length,
      query: q
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

module.exports = router;
