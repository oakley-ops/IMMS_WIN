const PurchaseOrder = require('../models/PurchaseOrder');
const { pool } = require('../../db');
const { body, validationResult } = require('express-validator');
const { format } = require('date-fns');
const { getClientWithTimeout } = require('../../utils/dbUtils');
const PODocumentService = require('../services/PODocumentService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const documentStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'po_documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename based on PO ID, timestamp and original extension
    const poId = req.params.id;
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname);
    const filename = `po-${poId}-${timestamp}${fileExt}`;
    cb(null, filename);
  }
});

// File filter to only allow certain file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage: documentStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

class PurchaseOrderController {
  constructor() {
    // Use the shared pool instance from db.js instead of creating a new one
    this.pool = pool;
    
    // Initialize the document service
    this.documentService = new PODocumentService(this.pool);
    
    // Bind methods to instance to prevent 'this' context loss
    this.createBlankPurchaseOrder = this.createBlankPurchaseOrder.bind(this);
    this.uploadDocument = this.uploadDocument.bind(this);
    this.getDocumentsByPurchaseOrderId = this.getDocumentsByPurchaseOrderId.bind(this);
    this.downloadDocument = this.downloadDocument.bind(this);
    this.deleteDocument = this.deleteDocument.bind(this);
  }

  async getAllPurchaseOrders(req, res) {
    try {
      const { startDate, endDate, search, page = 0, limit = 10, status } = req.query;
      
      console.log('Query params:', req.query);
      console.log('Searching for:', search);
      
      // Always include document search
      const includeDocSearch = true;
      let poIdsFromDocSearch = [];
      
      if (search) {
        try {
          console.log('Searching document content for:', search);
          
          // Split search into terms for more flexible matching
          const searchTerms = search.toLowerCase().split(/\s+/).filter(term => term.length > 1);
          console.log('Search terms:', searchTerms);
          
          if (searchTerms.length > 0) {
            // Build query to find documents containing ANY of the search terms
            let query = `
              SELECT DISTINCT doc.po_id, po.po_number, s.name as supplier_name
              FROM purchase_order_documents doc
              JOIN purchase_orders po ON doc.po_id = po.po_id
              LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
              WHERE 
            `;
            
            // Add conditions for each search term
            const termConditions = [];
            const params = [];
            
            // For each term, search in document content
            searchTerms.forEach((term, index) => {
              termConditions.push(`doc.text_content ILIKE $${index + 1}`);
              params.push(`%${term}%`);
            });
            
            query += termConditions.join(' OR ');
            console.log('Document search query:', query);
            console.log('Document search params:', params);
            
            const documentResults = await this.pool.query(query, params);
            poIdsFromDocSearch = documentResults.rows.map(doc => doc.po_id);
            
            console.log(`Found ${poIdsFromDocSearch.length} purchase orders with matching document content:`, 
              documentResults.rows.map(r => `${r.po_number} (${r.supplier_name})`));
          }
        } catch (docSearchError) {
          console.error('Error searching document content:', docSearchError);
          // Continue with normal search if document search fails
        }
      }
      
      // Build the query with conditions
      let query = `
        SELECT po.*, 
               COALESCE(po.approval_status, po.status) as status,
               s.name as supplier_name, 
               s.address as supplier_address, 
               s.email as supplier_email, 
               s.phone as supplier_phone
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      `;

      // Build where clause conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Date filters - careful with date formatting
      if (startDate) {
        conditions.push(`po.created_at::date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        conditions.push(`po.created_at::date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      // Status filter
      if (status && status !== 'all') {
        conditions.push(`COALESCE(po.approval_status, po.status) = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      // Enhanced search filter with multiple terms
      if (search) {
        const searchTerms = search.toLowerCase().split(/\s+/).filter(term => term.length > 1);
        
        if (searchTerms.length > 0) {
          const metadataConditions = [];
          
          // Look for each term in metadata
          searchTerms.forEach(term => {
            metadataConditions.push(`po.po_number ILIKE $${paramIndex}`);
            params.push(`%${term}%`);
            paramIndex++;
            
            metadataConditions.push(`s.name ILIKE $${paramIndex}`);
            params.push(`%${term}%`);
            paramIndex++;
          });
          
          // Add document search results if any
          if (poIdsFromDocSearch.length > 0) {
            conditions.push(`(${metadataConditions.join(' OR ')} OR po.po_id = ANY($${paramIndex}))`);
            params.push(poIdsFromDocSearch);
            paramIndex++;
          } else {
            conditions.push(`(${metadataConditions.join(' OR ')})`);
          }
        }
      }

      // Add WHERE clause if we have conditions
      let whereClause = '';
      if (conditions.length > 0) {
        whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
      }

      // Add ordering
      query += ' ORDER BY po.created_at DESC';
      
      // Create count query using the same conditions
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
        ${whereClause}
      `;
      
      console.log('Count Query:', countQuery);
      console.log('Query params:', params);
      
      // Execute count query first
      const countResult = await this.pool.query(countQuery, [...params]);
      const total = parseInt(countResult.rows[0]?.total || 0);
      
      // Add pagination to the main query
      if (limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        paramIndex++;
      }
      
      if (page && parseInt(page) > 0) {
        const offset = parseInt(page) * parseInt(limit);
        query += ` OFFSET $${paramIndex}`;
        params.push(offset);
        paramIndex++;
      }
      
      console.log('Data Query:', query);
      
      // Now execute the main query
      const dataResult = await this.pool.query(query, params);
      
      console.log(`Found ${dataResult.rows.length} purchase orders out of ${total} total`);
      
      // Return the paginated results
      res.json({
        items: dataResult.rows,
        total,
        page: parseInt(page || 0),
        limit: parseInt(limit || 10),
        totalPages: Math.ceil(total / parseInt(limit || 10)),
        docSearchIncluded: includeDocSearch
      });
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      res.status(500).send(`Error fetching purchase orders: ${error.message}`);
    }
  }

  async getPurchaseOrderById(req, res) {
    const { id } = req.params;
    
    try {
      const poResult = await this.pool.query(`
        SELECT po.*, s.name as supplier_name, s.contact_name, s.email, s.phone, s.address
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
        WHERE po.po_id = $1
      `, [id]);

      if (poResult.rows.length === 0) {
        return res.status(404).send('Purchase order not found');
      }

      // Get the purchase order items
      const itemsResult = await this.pool.query(`
        SELECT poi.*, p.name as part_name, p.manufacturer_part_number, p.fiserv_part_number
        FROM purchase_order_items poi
        LEFT JOIN parts p ON poi.part_id = p.part_id
        WHERE poi.po_id = $1
      `, [id]);

      // Combine the results
      const purchaseOrder = {
        ...poResult.rows[0],
        items: itemsResult.rows
      };
      
      // Parse the notes field to add virtual priority and shipping fields
      if (purchaseOrder.notes) {
        const isUrgentMatch = purchaseOrder.notes.match(/\[PRIORITY:\s*(urgent|normal)\]/i);
        const nextDayAirMatch = purchaseOrder.notes.match(/\[SHIPPING:\s*(nextday|regular)\]/i);
        
        // Add virtual fields to the response
        purchaseOrder.is_urgent = isUrgentMatch ? isUrgentMatch[1].toLowerCase() === 'urgent' : false;
        purchaseOrder.priority = isUrgentMatch ? isUrgentMatch[1].toLowerCase() : 'normal';
        purchaseOrder.next_day_air = nextDayAirMatch ? nextDayAirMatch[1].toLowerCase() === 'nextday' : false;
      } else {
        purchaseOrder.is_urgent = false;
        purchaseOrder.priority = 'normal';
        purchaseOrder.next_day_air = false;
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching purchase order');
    }
  }

  async createPurchaseOrder(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      supplier_id,
      notes,
      items,
      po_number: customPoNumber,
      requested_by,
      approved_by
    } = req.body;

    // Start a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      let poNumber;
      
      // Use custom PO number if provided, otherwise generate one
      if (customPoNumber && customPoNumber.trim()) {
        // Check if the PO number already exists
        const existingPoResult = await client.query(
          "SELECT po_number FROM purchase_orders WHERE po_number = $1",
          [customPoNumber.trim()]
        );
        
        if (existingPoResult.rows.length > 0) {
          throw new Error('Purchase order number already exists');
        }
        
        poNumber = customPoNumber.trim();
      } else {
        // Generate a unique PO number (Year-Month-SequentialNumber)
        const currentDate = new Date();
        const poPrefix = format(currentDate, 'yyyyMM');
        
        // Get the latest PO number with this prefix
        const poNumResult = await client.query(
          "SELECT po_number FROM purchase_orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1",
          [`${poPrefix}%`]
        );
        
        let nextNum = 1;
        if (poNumResult.rows.length > 0) {
          // Extract the last number and increment
          const lastPO = poNumResult.rows[0].po_number;
          const lastNum = parseInt(lastPO.split('-')[1]);
          nextNum = lastNum + 1;
        }
        
        poNumber = `${poPrefix}-${nextNum.toString().padStart(4, '0')}`;
      }
      
      // Calculate the total amount
      let totalAmount = 0;
      for (const item of items) {
        // Ensure we're working with numbers, not strings
        const quantity = parseInt(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;
        
        console.log(`Backend calculation: Part ${item.part_id}, Qty: ${quantity}, Unit Price: ${unitPrice}, Line Total: ${lineTotal}`);
        
        totalAmount += lineTotal;
      }
      
      // Convert to fixed precision to avoid floating point issues
      totalAmount = parseFloat(totalAmount.toFixed(2));
      console.log(`Final total amount for PO: ${totalAmount}`);
      
      // Create the purchase order
      const poQuery = `
        INSERT INTO purchase_orders (
          po_number, supplier_id, status, total_amount, 
          shipping_cost, tax_amount, notes, 
          requested_by, approved_by
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *
      `;
      
      const poValues = [
        poNumber,
        supplier_id,
        'pending',
        totalAmount,
        0,
        0,
        notes || '',
        requested_by || null,
        approved_by || null
      ];
      
      const poResult = await client.query(poQuery, poValues);
      
      const poId = poResult.rows[0].po_id;
      
      // Add the items
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items (po_id, part_id, quantity, unit_price, total_price) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            poId,
            item.part_id,
            item.quantity,
            item.unit_price,
            parseFloat((parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2))
          ]
        );
      }
      
      await client.query('COMMIT');
      
      // Get the complete purchase order with items
      const completePO = await this.getPurchaseOrderWithItems(poId);
      
      res.status(201).json(completePO);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error creating purchase order');
    } finally {
      client.release();
    }
  }
  
  async getPurchaseOrderWithItems(poId) {
    const poResult = await this.pool.query(`
      SELECT po.*, s.name as supplier_name, s.contact_name, s.email, s.phone, s.address
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.po_id = $1
    `, [poId]);
    
    if (poResult.rows.length === 0) {
      return null;
    }
    
    const po = poResult.rows[0];
    
    // Get purchase order items
    const itemsResult = await this.pool.query(`
      SELECT poi.*, p.name as part_name, p.fiserv_part_number, p.manufacturer_part_number
      FROM purchase_order_items poi
      LEFT JOIN parts p ON poi.part_id = p.part_id
      WHERE poi.po_id = $1
    `, [poId]);
    
    po.items = itemsResult.rows;
    
    // Make sure we have supplier_name for Excel export
    if (!po.supplier_name && po.supplier_id) {
      const supplierResult = await this.pool.query(
        'SELECT name FROM suppliers WHERE supplier_id = $1',
        [po.supplier_id]
      );
      
      if (supplierResult.rows.length > 0) {
        po.supplier_name = supplierResult.rows[0].name;
      }
    }
    
    return po;
  }

  async updatePurchaseOrderStatus(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const poId = parseInt(req.params.id);
    const { status } = req.body;

    try {
      const result = await this.pool.query(
        `UPDATE purchase_orders 
         SET status = $1::text, 
             approval_status = $1::text,
             updated_at = CURRENT_TIMESTAMP,
             approval_date = CASE WHEN $1::text IN ('approved', 'rejected', 'on_hold') THEN CURRENT_TIMESTAMP ELSE approval_date END
         WHERE po_id = $2 RETURNING *`,
        [status, poId]
      );

      if (result.rows.length === 0) {
        return res.status(404).send('Purchase order not found');
      }

      // Generate a document based on the status change
      try {
        // Get the purchase order details for document generation
        const po = await this.getPurchaseOrderWithItems(poId);
        
        // Get the username from the request if available, or use 'system' as default
        const username = req.user?.username || 'system';
        
        if (status === 'received') {
          // Generate the receipt document
          await this.documentService.generateReceiptDocument(po, username);
        } else if (status === 'approved') {
          // Generate the approval document
          await this.documentService.generateApprovalDocument(po, username);
        }
      } catch (docError) {
        console.error(`Error generating document for status ${status}:`, docError);
        // Don't fail the whole request if document generation fails
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error updating purchase order status');
    }
  }

  async updatePurchaseOrder(req, res) {
    try {
      const poId = req.params.id;
      const updateData = req.body;
      
      // Get current purchase order data
      const result = await this.pool.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [poId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: `Purchase order with ID ${poId} not found.`
        });
      }
      
      let notes = result.rows[0].notes || '';
      
      // If we're updating priority or shipping, update the notes
      if (updateData.hasOwnProperty('is_urgent') || updateData.hasOwnProperty('priority') || updateData.hasOwnProperty('next_day_air')) {
        // Parse existing flags from notes
        const isUrgentMatch = notes.match(/\[PRIORITY:\s*(urgent|normal)\]/i);
        const nextDayAirMatch = notes.match(/\[SHIPPING:\s*(nextday|regular)\]/i);
        
        let priority = isUrgentMatch ? isUrgentMatch[1].toLowerCase() : 'normal';
        let shipping = nextDayAirMatch ? nextDayAirMatch[1].toLowerCase() : 'regular';
        
        // Update with new values if provided
        if (updateData.hasOwnProperty('is_urgent')) {
          priority = updateData.is_urgent ? 'urgent' : 'normal';
        }
        
        if (updateData.hasOwnProperty('priority')) {
          priority = updateData.priority;
        }
        
        if (updateData.hasOwnProperty('next_day_air')) {
          shipping = updateData.next_day_air ? 'nextday' : 'regular';
        }
        
        // Remove existing flags
        notes = notes.replace(/\[PRIORITY:\s*(?:urgent|normal)\]/ig, '');
        notes = notes.replace(/\[SHIPPING:\s*(?:nextday|regular)\]/ig, '');
        
        // Add updated flags
        const flagsText = `[PRIORITY: ${priority}] [SHIPPING: ${shipping}]`;
        
        // If notes are empty or just whitespace, just use the flags
        if (!notes.trim()) {
          notes = flagsText;
        } else {
          // Otherwise add flags at the beginning
          notes = `${flagsText} ${notes.trim()}`;
        }
      }
      
      // Check for shipping_cost and tax_amount in the notes if we're updating those
      if (updateData.hasOwnProperty('shipping_cost') || updateData.hasOwnProperty('tax_amount')) {
        // Extract existing shipping cost and tax amount from notes if they exist
        const shippingMatch = notes.match(/\[SHIPPING_COST:\s*([\d.]+)\]/i);
        const taxMatch = notes.match(/\[TAX_AMOUNT:\s*([\d.]+)\]/i);
        
        // Remove existing shipping and tax notes
        notes = notes.replace(/\[SHIPPING_COST:\s*[\d.]+\]/ig, '');
        notes = notes.replace(/\[TAX_AMOUNT:\s*[\d.]+\]/ig, '');
        
        // Add updated shipping cost and tax amount
        if (updateData.hasOwnProperty('shipping_cost')) {
          notes = `${notes.trim()} [SHIPPING_COST: ${updateData.shipping_cost}]`;
        } else if (shippingMatch) {
          notes = `${notes.trim()} [SHIPPING_COST: ${shippingMatch[1]}]`;
        }
        
        if (updateData.hasOwnProperty('tax_amount')) {
          notes = `${notes.trim()} [TAX_AMOUNT: ${updateData.tax_amount}]`;
        } else if (taxMatch) {
          notes = `${notes.trim()} [TAX_AMOUNT: ${taxMatch[1]}]`;
        }
        
        notes = notes.trim();
      }
      
      // Try updating with the new fields first, fall back to notes-based approach if columns don't exist
      try {
        // Prepare the update query
        let updateFields = ['notes = $1'];
        let queryParams = [notes];
        let paramIndex = 2;
        
        // Check for shipping cost and tax amount updates
        if (updateData.hasOwnProperty('shipping_cost')) {
          updateFields.push(`shipping_cost = $${paramIndex}`);
          queryParams.push(updateData.shipping_cost);
          paramIndex++;
        }
        
        if (updateData.hasOwnProperty('tax_amount')) {
          updateFields.push(`tax_amount = $${paramIndex}`);
          queryParams.push(updateData.tax_amount);
          paramIndex++;
        }
        
        // Handle PO number updates
        if (updateData.hasOwnProperty('po_number')) {
          updateFields.push(`po_number = $${paramIndex}`);
          queryParams.push(updateData.po_number);
          paramIndex++;
          console.log(`Updating PO number to: ${updateData.po_number}`);
        }
        
        // Handle requested_by updates
        if (updateData.hasOwnProperty('requested_by')) {
          updateFields.push(`requested_by = $${paramIndex}`);
          queryParams.push(updateData.requested_by);
          paramIndex++;
          console.log(`Updating requested_by to: ${updateData.requested_by}`);
        }
        
        // Handle approved_by updates
        if (updateData.hasOwnProperty('approved_by')) {
          updateFields.push(`approved_by = $${paramIndex}`);
          queryParams.push(updateData.approved_by);
          paramIndex++;
          console.log(`Updating approved_by to: ${updateData.approved_by}`);
        }
        
        // Always update timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        
        // Add the PO ID parameter
        queryParams.push(poId);
        
        // Update the purchase order with the modified fields
        console.log(`Updating purchase order ${poId} with fields: ${updateFields.join(', ')}`);
        
        const result = await this.pool.query(
          `UPDATE purchase_orders 
           SET ${updateFields.join(', ')} 
           WHERE po_id = $${paramIndex} RETURNING *`,
          queryParams
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            error: `Unable to update purchase order with ID ${poId}.`
          });
        }
        
        return res.status(200).json({
          message: `Purchase order ${poId} updated successfully.`,
          purchase_order: result.rows[0]
        });
      } catch (error) {
        console.error('Error updating purchase order with new fields:', error);
        
        // If we get a column doesn't exist error (code 42703), fallback to only updating notes
        if (error.code === '42703') {
          console.log('Columns do not exist yet, falling back to notes-only update');
          
          // If we're trying to update requested_by or approved_by, add them to notes
          if (updateData.hasOwnProperty('requested_by') || updateData.hasOwnProperty('approved_by')) {
            // Extract existing requested_by and approved_by from notes if they exist
            const requestedByMatch = notes.match(/\[REQUESTED_BY:\s*([^\]]+)\]/i);
            const approvedByMatch = notes.match(/\[APPROVED_BY:\s*([^\]]+)\]/i);
            
            // Remove existing requested_by and approved_by notes
            notes = notes.replace(/\[REQUESTED_BY:\s*[^\]]+\]/ig, '');
            notes = notes.replace(/\[APPROVED_BY:\s*[^\]]+\]/ig, '');
            
            // Add updated requested_by and approved_by
            if (updateData.hasOwnProperty('requested_by')) {
              notes = `${notes.trim()} [REQUESTED_BY: ${updateData.requested_by}]`;
            } else if (requestedByMatch) {
              notes = `${notes.trim()} [REQUESTED_BY: ${requestedByMatch[1]}]`;
            }
            
            if (updateData.hasOwnProperty('approved_by')) {
              notes = `${notes.trim()} [APPROVED_BY: ${updateData.approved_by}]`;
            } else if (approvedByMatch) {
              notes = `${notes.trim()} [APPROVED_BY: ${approvedByMatch[1]}]`;
            }
            
            notes = notes.trim();
          }
          
          const fallbackResult = await this.pool.query(
            `UPDATE purchase_orders 
             SET notes = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE po_id = $2 RETURNING *`,
            [notes, poId]
          );
          
          if (fallbackResult.rows.length === 0) {
            return res.status(404).json({
              error: `Unable to update purchase order with ID ${poId}.`
            });
          }
          
          return res.status(200).json({
            message: `Purchase order ${poId} updated successfully (using notes fallback).`,
            purchase_order: fallbackResult.rows[0]
          });
        } else {
          // For any other error, return the error
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating purchase order:', error);
      return res.status(500).json({
        error: `Error updating purchase order: ${error.message}`
      });
    }
  }

  async deletePurchaseOrder(req, res) {
    const { id } = req.params;
    console.log('Delete request received for PO:', id);
    
    let client;
    try {
      // Get a client with timeout
      client = await getClientWithTimeout(5000); // 5 second timeout for getting a client
      console.log('Database connection established');
      
      await client.query('BEGIN');
      console.log('Transaction started');
      
      // Check if the purchase order exists and can be deleted in a single query
      console.log('Checking if PO exists and can be deleted...');
      const poResult = await client.query(
        `SELECT status 
         FROM purchase_orders 
         WHERE po_id = $1 
         FOR UPDATE`,
        [id]
      );
      
      if (poResult.rows.length === 0) {
        console.log('PO not found:', id);
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Purchase order not found' });
      }
      
      // Check if the PO can be deleted (not in a final state)
      const po = poResult.rows[0];
      console.log('PO status:', po.status);
      
      if (po.status === 'approved' || po.status === 'received') {
        console.log('Cannot delete PO - status is:', po.status);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot delete a purchase order that has been approved or received' 
        });
      }
      
      // Set statement timeout for the delete operations
      await client.query('SET statement_timeout = 30000'); // 30 second timeout for the delete operations
      
      // Delete related records in a specific order to handle foreign key constraints
      console.log('Deleting related records...');
      
      // 0. Check and delete failed email attempts first
      console.log('Checking for failed email attempts...');
      try {
        // First check if the table exists
        const tableCheckResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'failed_email_attempts'
          );
        `);
        
        const tableExists = tableCheckResult.rows[0].exists;
        
        if (tableExists) {
          console.log('Deleting failed email attempts...');
          const failedEmailsResult = await client.query(
            `DELETE FROM failed_email_attempts WHERE po_id = $1 RETURNING *`,
            [id]
          );
          console.log(`Deleted ${failedEmailsResult.rowCount} failed email attempts`);
        } else {
          console.log('Table failed_email_attempts does not exist, skipping cleanup');
        }
      } catch (emailError) {
        console.warn('Error cleaning up failed email attempts (continuing with delete):', emailError.message);
      }
      
      // 1. Delete email tracking records
      console.log('Deleting email tracking records...');
      const emailTrackingResult = await client.query(
        `DELETE FROM po_email_tracking WHERE po_id = $1 RETURNING *`,
        [id]
      );
      console.log(`Deleted ${emailTrackingResult.rowCount} email tracking records`);
      
      // 2. Delete purchase order items
      console.log('Deleting purchase order items...');
      const itemsResult = await client.query(
        `DELETE FROM purchase_order_items WHERE po_id = $1 RETURNING *`,
        [id]
      );
      console.log(`Deleted ${itemsResult.rowCount} purchase order items`);
      
      // 3. Finally delete the purchase order
      console.log('Deleting purchase order...');
      const deleteResult = await client.query(
        `DELETE FROM purchase_orders WHERE po_id = $1 RETURNING *`,
        [id]
      );
      
      console.log('Delete operation completed:', deleteResult.rows.length > 0);
      
      await client.query('COMMIT');
      console.log('Transaction committed successfully');
      
      res.json({ message: 'Purchase order deleted successfully' });
    } catch (error) {
      console.error('Error in deletePurchaseOrder:', error);
      console.error('Error stack:', error.stack);
      
      if (client) {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back due to error');
      }
      
      // Check for specific error types
      if (error.message?.includes('statement timeout')) {
        return res.status(504).json({ 
          message: 'Delete operation timed out. Please try again.',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ 
          message: 'Cannot delete purchase order due to related records. Please ensure all related records are deleted first.',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      res.status(500).json({ 
        message: 'Error deleting purchase order',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (client) {
        client.release();
        console.log('Database connection released');
      }
    }
  }

  async generatePurchaseOrdersForParts(req, res) {
    // Important: This method relies on supplier-specific unit_cost from the part_suppliers table
    // as the single source of truth for pricing. The system uses ONLY this price field
    // for generating purchase orders, not the general part.unit_cost field.
    //
    // When updating prices, always update the supplier-specific unit_cost in the part_suppliers table.
    
    // Get all parts that need to be ordered grouped by supplier
    try {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Remove the check that blocks all PO generation if there are any pending orders
        // (We'll still check if individual parts already have pending orders)

        // Continue with original code
        // Check if custom PO numbers were provided
        const { parts, customPoNumbers } = req.body || {};
        
        // If parts were provided directly from the frontend, use them
        if (parts && Array.isArray(parts) && parts.length > 0) {
          console.log("Received parts from frontend:", parts);
          
          // Group parts by supplier
          const partsBySupplier = {};
          const TBD_SUPPLIER_KEY = '-1';
          
          // First pass - collect all parts with no supplier into the TBD group
          for (const part of parts) {
            if (!part.supplier_id) {
              if (!partsBySupplier[TBD_SUPPLIER_KEY]) {
                partsBySupplier[TBD_SUPPLIER_KEY] = {
                  supplier_id: null,
                  supplier_name: 'TBD',
                  parts: []
                };
              }
              
              // Get full part info
              const partResult = await client.query(
                'SELECT * FROM parts WHERE part_id = $1',
                [part.part_id]
              );
              
              if (partResult.rows.length === 0) {
                continue; // Skip if part not found
              }
              
              const fullPart = partResult.rows[0];
              
              // Check if the part already has a pending purchase order
              const existingPOCheck = await client.query(`
                SELECT po.po_id 
                FROM purchase_orders po
                JOIN purchase_order_items poi ON po.po_id = poi.po_id
                WHERE poi.part_id = $1 AND po.supplier_id IS NULL AND po.status IN ('pending', 'submitted', 'approved')
              `, [part.part_id]);
              
              // Skip if it already has an active order
              if (existingPOCheck.rows.length > 0) {
                console.log(`Skipping part ${part.part_id} as it already has an active purchase order (pending, submitted, or approved) in TBD group`);
                continue;
              }
              
              partsBySupplier[TBD_SUPPLIER_KEY].parts.push({
                part_id: fullPart.part_id,
                name: fullPart.name,
                manufacturer_part_number: fullPart.manufacturer_part_number,
                fiserv_part_number: fullPart.fiserv_part_number,
                current_quantity: fullPart.quantity,
                minimum_quantity: fullPart.minimum_quantity,
                quantity: part.quantity || Math.max((fullPart.minimum_quantity * 2) - fullPart.quantity, fullPart.minimum_quantity),
                unit_price: part.unit_cost !== undefined ? parseFloat(part.unit_cost) : 
                           parseFloat(fullPart.unit_cost) || 0,
                lead_time_days: 0,
                requested_by: part.requested_by || null,
                approved_by: part.approved_by || null
              });
            }
          }
          
          // Second pass - process parts with suppliers
          for (const part of parts) {
            const supplierId = part.supplier_id;
            // Skip parts without suppliers (already handled in first pass)
            if (!supplierId) {
              continue;
            }
            
            // Check if part already has a pending purchase order
            const existingPOCheck = await client.query(`
              SELECT po.po_id 
              FROM purchase_orders po
              JOIN purchase_order_items poi ON po.po_id = poi.po_id
              WHERE poi.part_id = $1 AND po.supplier_id = $2 AND po.status IN ('pending', 'submitted', 'approved')
            `, [part.part_id, part.supplier_id]);
            
            // Skip this part if it already has a pending purchase order
            if (existingPOCheck.rows.length > 0) {
              console.log(`Skipping part ${part.part_id} as it already has a pending purchase order`);
              continue;
            }
            
            if (!partsBySupplier[supplierId]) {
              // Get supplier info
              const supplierResult = await client.query(
                'SELECT * FROM suppliers WHERE supplier_id = $1',
                [supplierId]
              );
              
              const supplier = supplierResult.rows[0] || { name: 'Unknown Supplier' };
              
              partsBySupplier[supplierId] = {
                supplier_id: supplierId,
                supplier_name: supplier.name,
                parts: []
              };
            }
            
            // Get full part info
            const partResult = await client.query(
              'SELECT * FROM parts WHERE part_id = $1',
              [part.part_id]
            );
            
            if (partResult.rows.length === 0) {
              continue; // Skip if part not found
            }
            
            const fullPart = partResult.rows[0];
            
            // Get supplier-specific info
            const supplierPartResult = await client.query(
              'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
              [part.part_id, supplierId]
            );
            
            const supplierPart = supplierPartResult.rows[0] || {};
            
            partsBySupplier[supplierId].parts.push({
              part_id: fullPart.part_id,
              name: fullPart.name,
              manufacturer_part_number: fullPart.manufacturer_part_number,
              fiserv_part_number: fullPart.fiserv_part_number,
              current_quantity: fullPart.quantity,
              minimum_quantity: fullPart.minimum_quantity,
              quantity: part.quantity || Math.max((fullPart.minimum_quantity * 2) - fullPart.quantity, fullPart.minimum_quantity),
              unit_price: part.unit_cost !== undefined ? parseFloat(part.unit_cost) : 
                         parseFloat(supplierPart.unit_cost) || 0,
              lead_time_days: supplierPart.lead_time_days || 0,
              requested_by: part.requested_by || null,
              approved_by: part.approved_by || null
            });
          }
          
          // If no parts were grouped (e.g., all parts had invalid suppliers), return error
          if (Object.keys(partsBySupplier).length === 0) {
            return res.status(400).json({ message: 'No valid parts with suppliers found for reorder' });
          }
          
          // Create purchase orders for each supplier
          const createdPOs = [];
          const currentDate = new Date();
          const poPrefix = format(currentDate, 'yyyyMM');
          
          // Get the latest PO number with this prefix to start our sequence
          const nextPoNumberResult = await client.query(
            "SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 as next_num FROM purchase_orders WHERE po_number LIKE $1",
            [`${poPrefix}-%`]
          );
          
          let nextNum = 1;
          if (nextPoNumberResult.rows.length > 0) {
            nextNum = nextPoNumberResult.rows[0].next_num;
          }
          
          // Create POs for each supplier
          let supplierIndex = 0;
          for (const supplierId in partsBySupplier) {
            const supplierData = partsBySupplier[supplierId];
            
            // Determine PO number - use custom if provided, otherwise generate
            let poNumber;
            const supplierIdStr = supplierId.toString();
            
            if (customPoNumbers && customPoNumbers[supplierIdStr]) {
              // Check if the PO number already exists
              const customPoNum = customPoNumbers[supplierIdStr].trim();
              const existingPoResult = await client.query(
                "SELECT po_number FROM purchase_orders WHERE po_number = $1",
                [customPoNum]
              );
              
              if (existingPoResult.rows.length > 0) {
                throw new Error(`Purchase order number ${customPoNum} already exists`);
              }
              
              poNumber = customPoNum;
            } else {
              poNumber = `${poPrefix}-${nextNum.toString().padStart(4, '0')}`;
              nextNum++;
            }

            // Calculate total amount
            let totalAmount = 0;
            for (const part of supplierData.parts) {
              // Ensure we're working with numbers, not strings
              const quantity = parseInt(part.quantity) || 0;
              const unitPrice = parseFloat(part.unit_price || 0);
              const lineTotal = quantity * unitPrice;
              
              console.log(`Backend calculation: Part ${part.part_id}, Qty: ${quantity}, Unit Price: ${unitPrice}, Line Total: ${lineTotal}`);
              
              totalAmount += lineTotal;
            }
            
            // Convert to fixed precision to avoid floating point issues
            totalAmount = parseFloat(totalAmount.toFixed(2));
            console.log(`Final total amount for PO: ${totalAmount}`);
            
            // Create the PO - handle special TBD case
            let poResult;
            if (supplierId === TBD_SUPPLIER_KEY) {
              // For TBD supplier, set supplier_id to null
              poResult = await client.query(
                `INSERT INTO purchase_orders (
                  po_number, supplier_id, status, total_amount, notes, requested_by, approved_by
                ) VALUES ($1, NULL, $2, $3, $4, $5, $6) RETURNING *`,
                [
                  poNumber,
                  'pending',
                  totalAmount,
                  'Auto-generated for parts without assigned supplier',
                  supplierData.parts[0].requested_by || null,
                  supplierData.parts[0].approved_by || null
                ]
              );
            } else {
              // For regular suppliers
              poResult = await client.query(
                `INSERT INTO purchase_orders (
                  po_number, supplier_id, status, total_amount, notes, requested_by, approved_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                  poNumber,
                  supplierId,
                  'pending',
                  totalAmount,
                  'Auto-generated for low stock parts',
                  supplierData.parts[0].requested_by || null,
                  supplierData.parts[0].approved_by || null
                ]
              );
            }
            
            const newPO = poResult.rows[0];
            
            // Add PO items
            for (const part of supplierData.parts) {
              await client.query(
                `INSERT INTO purchase_order_items (
                  po_id, part_id, quantity, unit_price, total_price
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  newPO.po_id,
                  part.part_id,
                  part.quantity,
                  part.unit_price,
                  parseFloat((parseFloat(part.quantity) * parseFloat(part.unit_price)).toFixed(2))
                ]
              );
            }
            
            // Add supplier name for convenience
            newPO.supplier_name = supplierData.supplier_name;
            
            // Add items to return data
            const items = await client.query(
              `SELECT poi.*, p.name, p.fiserv_part_number, p.manufacturer_part_number
               FROM purchase_order_items poi
               JOIN parts p ON poi.part_id = p.part_id
               WHERE poi.po_id = $1`,
              [newPO.po_id]
            );
            
            newPO.items = items.rows;
            
            createdPOs.push(newPO);
            supplierIndex++;
          }
          
          await client.query('COMMIT');
          return res.json(createdPOs);
        } else {
          // Original implementation using backend logic to detect parts needing reorder
          // Find all parts that need to be ordered
          const partsToOrderResult = await client.query(`
            SELECT 
              p.*,
              ps.supplier_id,
              s.name as supplier_name,
              ps.unit_cost as supplier_unit_cost,
              ps.lead_time_days,
              ps.minimum_order_quantity,
              ps.is_preferred
            FROM parts p
            JOIN (
              SELECT DISTINCT ON (part_id) part_id, supplier_id, unit_cost, lead_time_days, minimum_order_quantity, is_preferred
              FROM part_suppliers
              ORDER BY part_id, is_preferred DESC, unit_cost ASC
            ) ps ON p.part_id = ps.part_id
            JOIN suppliers s ON ps.supplier_id = s.supplier_id
            WHERE (p.quantity <= p.minimum_quantity OR p.quantity = 0)
            ORDER BY ps.supplier_id
          `);

          if (partsToOrderResult.rows.length === 0) {
            return res.status(404).json({ message: 'No parts to reorder at this time.\nAll parts are currently above their minimum quantity levels.' });
          }

          // Group parts by supplier
          const partsBySupplier = {};
          const TBD_SUPPLIER_KEY = '-1';
          
          // First pass - collect all parts with no supplier into the TBD group
          for (const part of partsToOrderResult.rows) {
            if (!part.supplier_id) {
              if (!partsBySupplier[TBD_SUPPLIER_KEY]) {
                partsBySupplier[TBD_SUPPLIER_KEY] = {
                  supplier_id: null,
                  supplier_name: 'TBD',
                  parts: []
                };
              }
              
              // Check if the part already has a pending purchase order
              const existingPOCheck = await client.query(`
                SELECT po.po_id 
                FROM purchase_orders po
                JOIN purchase_order_items poi ON po.po_id = poi.po_id
                WHERE poi.part_id = $1 AND po.supplier_id IS NULL AND po.status IN ('pending', 'submitted', 'approved')
              `, [part.part_id]);
              
              // Skip if it already has an active order
              if (existingPOCheck.rows.length > 0) {
                console.log(`Skipping part ${part.part_id} as it already has an active purchase order (pending, submitted, or approved) in TBD group`);
                continue;
              }
              
              partsBySupplier[TBD_SUPPLIER_KEY].parts.push({
                part_id: part.part_id,
                name: part.name,
                manufacturer_part_number: part.manufacturer_part_number,
                fiserv_part_number: part.fiserv_part_number,
                current_quantity: part.quantity,
                minimum_quantity: part.minimum_quantity,
                quantity: Math.max(
                  Math.max(
                    (part.minimum_quantity * 2) - part.quantity,
                    part.minimum_quantity
                  ),
                  part.minimum_order_quantity || 1
                ),
                unit_price: part.unit_cost !== undefined ? parseFloat(part.unit_cost) : 
                           parseFloat(part.supplier_unit_cost) || 0,
                lead_time_days: 0,
                requested_by: null,
                approved_by: null
              });
            }
          }
          
          // Second pass - process parts with suppliers
          for (const part of partsToOrderResult.rows) {
            const supplierId = part.supplier_id;
            // Skip parts without suppliers (already handled in first pass)
            if (!supplierId) {
              continue;
            }
            
            // Check if part already has a pending purchase order
            const existingPOCheck = await client.query(`
              SELECT po.po_id 
              FROM purchase_orders po
              JOIN purchase_order_items poi ON po.po_id = poi.po_id
              WHERE poi.part_id = $1 AND po.supplier_id = $2 AND po.status IN ('pending', 'submitted', 'approved')
            `, [part.part_id, part.supplier_id]);
            
            // Skip this part if it already has a pending, submitted, or approved purchase order
            if (existingPOCheck.rows.length > 0) {
              console.log(`Skipping part ${part.part_id} as it already has an active purchase order (pending, submitted, or approved)`);
              continue;
            }
            
            if (!partsBySupplier[supplierId]) {
              partsBySupplier[supplierId] = {
                supplier_id: supplierId,
                supplier_name: part.supplier_name,
                parts: []
              };
            }
            
            // Calculate order quantity (2x minimum_quantity - current quantity)
            // This ensures we order enough to get above the minimum threshold
            const minimumOrderQuantity = part.minimum_order_quantity || 1;
            const orderQuantity = Math.max(
              Math.max(
                (part.minimum_quantity * 2) - part.quantity,
                part.minimum_quantity
              ),
              minimumOrderQuantity
            );
            
            partsBySupplier[supplierId].parts.push({
              part_id: part.part_id,
              name: part.name,
              manufacturer_part_number: part.manufacturer_part_number,
              fiserv_part_number: part.fiserv_part_number,
              current_quantity: part.quantity,
              minimum_quantity: part.minimum_quantity,
              quantity: orderQuantity,
              unit_price: part.unit_cost !== undefined ? parseFloat(part.unit_cost) : 
                         parseFloat(part.supplier_unit_cost) || 0,
              lead_time_days: part.lead_time_days || 0,
              requested_by: null,
              approved_by: null
            });
          }

          // Create purchase orders for each supplier
          const createdPOs = [];
          const currentDate = new Date();
          const poPrefix = format(currentDate, 'yyyyMM');
          
          // Get the latest PO number with this prefix to start our sequence
          const nextPoNumberResult = await client.query(
            "SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 as next_num FROM purchase_orders WHERE po_number LIKE $1",
            [`${poPrefix}-%`]
          );
          
          let nextNum = 1;
          if (nextPoNumberResult.rows.length > 0) {
            nextNum = nextPoNumberResult.rows[0].next_num;
          }

          let supplierIndex = 0;
          for (const supplierId in partsBySupplier) {
            const supplierData = partsBySupplier[supplierId];
            
            // Determine PO number - use custom if provided, otherwise generate
            let poNumber;
            
            if (customPoNumbers && customPoNumbers[supplierIndex]) {
              // Check if the PO number already exists
              const customPoNum = customPoNumbers[supplierIndex].trim();
              const existingPoResult = await client.query(
                "SELECT po_number FROM purchase_orders WHERE po_number = $1",
                [customPoNum]
              );
              
              if (existingPoResult.rows.length > 0) {
                throw new Error('Purchase order number already exists');
              }
              
              poNumber = customPoNum;
            } else {
              poNumber = `${poPrefix}-${nextNum.toString().padStart(4, '0')}`;
              nextNum++;
            }

            // Calculate total amount
            let totalAmount = 0;
            for (const part of supplierData.parts) {
              // Ensure we're working with numbers, not strings
              const quantity = parseInt(part.quantity) || 0;
              const unitPrice = parseFloat(part.unit_price || 0);
              const lineTotal = quantity * unitPrice;
              
              console.log(`Backend calculation: Part ${part.part_id}, Qty: ${quantity}, Unit Price: ${unitPrice}, Line Total: ${lineTotal}`);
              
              totalAmount += lineTotal;
            }
            
            // Convert to fixed precision to avoid floating point issues
            totalAmount = parseFloat(totalAmount.toFixed(2));
            console.log(`Final total amount for PO: ${totalAmount}`);
            
            // Create the PO - handle special TBD case
            let poResult;
            if (supplierId === TBD_SUPPLIER_KEY) {
              // For TBD supplier, set supplier_id to null
              poResult = await client.query(
                `INSERT INTO purchase_orders (
                  po_number, supplier_id, status, total_amount, notes, requested_by, approved_by
                ) VALUES ($1, NULL, $2, $3, $4, $5, $6) RETURNING *`,
                [
                  poNumber,
                  'pending',
                  totalAmount,
                  'Auto-generated for parts without assigned supplier',
                  null,
                  null
                ]
              );
            } else {
              // For regular suppliers
              poResult = await client.query(
                `INSERT INTO purchase_orders (
                  po_number, supplier_id, status, total_amount, notes, requested_by, approved_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                  poNumber,
                  supplierId,
                  'pending',
                  totalAmount,
                  'Auto-generated for low stock parts',
                  null,
                  null
                ]
              );
            }
            
            const newPO = poResult.rows[0];
            
            // Add PO items
            for (const part of supplierData.parts) {
              await client.query(
                `INSERT INTO purchase_order_items (
                  po_id, part_id, quantity, unit_price, total_price
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  newPO.po_id,
                  part.part_id,
                  part.quantity,
                  part.unit_price,
                  parseFloat((parseFloat(part.quantity) * parseFloat(part.unit_price)).toFixed(2))
                ]
              );
            }
            
            // Add supplier name for convenience
            newPO.supplier_name = supplierData.supplier_name;
            
            // Add items to return data
            const items = await client.query(
              `SELECT poi.*, p.name, p.fiserv_part_number, p.manufacturer_part_number
               FROM purchase_order_items poi
               JOIN parts p ON poi.part_id = p.part_id
               WHERE poi.po_id = $1`,
              [newPO.po_id]
            );
            
            newPO.items = items.rows;
            
            createdPOs.push(newPO);
            supplierIndex++;
          }
          
          await client.query('COMMIT');
          res.status(201).json({
            message: `Successfully generated ${createdPOs.length} purchase orders`,
            purchase_orders: createdPOs
          });
        }
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).send(`Error generating purchase orders: ${error.message}`);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Error generating purchase orders');
    }
  }

  async getPartsWithPendingOrders(req, res) {
    try {
      // Get all parts that are currently in active purchase orders (pending, submitted, or approved)
      const query = `
        SELECT DISTINCT poi.part_id, p.name, p.fiserv_part_number
        FROM purchase_order_items poi
        JOIN purchase_orders po ON poi.po_id = po.po_id
        JOIN parts p ON poi.part_id = p.part_id
        WHERE po.status IN ('pending', 'submitted', 'approved')
        ORDER BY p.name
      `;
      
      const result = await this.pool.query(query);
      console.log(`Found ${result.rows.length} parts with active purchase orders`);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching parts with active orders:', error);
      res.status(500).json({ 
        error: 'Error fetching parts with active orders',
        message: error.message
      });
    }
  }

  getValidationRules(isBlank = false) {
    const baseRules = [
      body('supplier_id').isInt().withMessage('Supplier ID must be an integer'),
      body('requested_by').optional().isString().withMessage('Requested by must be a string'),
      body('approved_by').optional().isString().withMessage('Approved by must be a string')
    ];
    
    if (!isBlank) {
      // Only apply these rules for regular POs, not blank ones
      baseRules.push(
        body('items').isArray().withMessage('Items must be an array'),
        body('items.*.part_id').isInt().withMessage('Part ID must be an integer'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
        body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number')
      );
    } else {
      // For blank POs, items is optional
      baseRules.push(
        body('items').optional().isArray().withMessage('Items must be an array if provided')
      );
    }
    
    return baseRules;
  }

  // Add an item to a purchase order
  async addItemToPurchaseOrder(req, res) {
    const { id } = req.params;
    const { part_id, custom_part, part_name, part_number, quantity, unit_price } = req.body;
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the purchase order exists
      const poResult = await client.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [id]
      );
      
      if (poResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Purchase order not found' });
      }
      
      const po = poResult.rows[0];
      
      // Check if the purchase order is in a state that allows editing
      if (po.status !== 'pending' && po.status !== 'on_hold') {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot modify items in a purchase order that is not pending or on hold' 
        });
      }
      
      // Calculate total price
      const total_price = parseFloat(quantity) * parseFloat(unit_price);
      
      let itemResult;

      if (custom_part) {
        // For custom/miscellaneous items not in the database
        console.log('Adding custom part to PO:', { part_name, part_number, quantity, unit_price });
        
        // Store custom part info in notes field since we don't have dedicated columns
        const notes = JSON.stringify({
          custom_part: true,
          part_name: part_name || 'Custom part',
          part_number: part_number || 'N/A'
        });
        
        // Add directly to purchase_order_items without using custom columns
        itemResult = await client.query(
          `INSERT INTO purchase_order_items 
           (po_id, part_id, quantity, unit_price, total_price, notes) 
           VALUES ($1, NULL, $2, $3, $4, $5) 
           RETURNING *`,
          [id, quantity, unit_price, total_price, notes]
        );
        
      } else {
        // For parts from the database
        // Check if the part exists
        const partResult = await client.query(
          'SELECT * FROM parts WHERE part_id = $1',
          [part_id]
        );
        
        if (partResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Part not found' });
        }

        // Insert the new item with reference to the part in the database
        itemResult = await client.query(
          `INSERT INTO purchase_order_items 
           (po_id, part_id, quantity, unit_price, total_price) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [id, part_id, quantity, unit_price, total_price]
        );
      }
      
      // Update the total amount of the purchase order
      await client.query(
        `UPDATE purchase_orders 
         SET total_amount = (
           SELECT SUM(total_price) 
           FROM purchase_order_items 
           WHERE po_id = $1
         )
         WHERE po_id = $1`,
        [id]
      );
      
      await client.query('COMMIT');
      
      let responseItem;
      
      if (custom_part) {
        // For custom items, create a response with the item data
        responseItem = {
          ...itemResult.rows[0],
          part_name: part_name || 'Custom part',
          custom_part: true,
          part_number: part_number || 'N/A'
        };
      } else {
        // For database parts, fetch the part details to include in response
        const part = await client.query(
          'SELECT name, manufacturer_part_number, fiserv_part_number FROM parts WHERE part_id = $1',
          [part_id]
        );
        
        responseItem = {
          ...itemResult.rows[0],
          part_name: part.rows[0]?.name,
          manufacturer_part_number: part.rows[0]?.manufacturer_part_number,
          fiserv_part_number: part.rows[0]?.fiserv_part_number
        };
      }
      
      res.status(201).json(responseItem);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding item to purchase order:', error);
      res.status(500).json({ message: 'Failed to add item to purchase order' });
    } finally {
      client.release();
    }
  }
  
  // Remove an item from a purchase order
  async removeItemFromPurchaseOrder(req, res) {
    const { id, itemId } = req.params;
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the purchase order exists
      const poResult = await client.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [id]
      );
      
      if (poResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Purchase order not found' });
      }
      
      const po = poResult.rows[0];
      
      // Check if the purchase order is in a state that allows editing
      if (po.status !== 'pending' && po.status !== 'on_hold') {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot modify items in a purchase order that is not pending or on hold' 
        });
      }
      
      // Check if item exists
      const itemResult = await client.query(
        'SELECT * FROM purchase_order_items WHERE item_id = $1 AND po_id = $2',
        [itemId, id]
      );
      
      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Item not found in this purchase order' });
      }
      
      // Check if this is the last item in the purchase order
      const countResult = await client.query(
        'SELECT COUNT(*) FROM purchase_order_items WHERE po_id = $1',
        [id]
      );
      
      if (parseInt(countResult.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot remove the last item from a purchase order. A purchase order must contain at least one item.' 
        });
      }
      
      // Delete the item
      await client.query(
        'DELETE FROM purchase_order_items WHERE item_id = $1 AND po_id = $2',
        [itemId, id]
      );
      
      // Update the total amount of the purchase order
      await client.query(
        `UPDATE purchase_orders 
         SET total_amount = (
           SELECT SUM(total_price) 
           FROM purchase_order_items 
           WHERE po_id = $1
         )
         WHERE po_id = $1`,
        [id]
      );
      
      await client.query('COMMIT');
      
      res.status(200).json({ message: 'Item removed successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error removing item from purchase order:', error);
      res.status(500).json({ message: 'Failed to remove item from purchase order' });
    } finally {
      client.release();
    }
  }
  
  // Update an item in a purchase order
  async updateItemInPurchaseOrder(req, res) {
    const { id, itemId } = req.params;
    const { quantity, unit_price } = req.body;
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the purchase order exists
      const poResult = await client.query(
        'SELECT * FROM purchase_orders WHERE po_id = $1',
        [id]
      );
      
      if (poResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Purchase order not found' });
      }
      
      const po = poResult.rows[0];
      
      // Check if the purchase order is in a state that allows editing
      if (po.status !== 'pending' && po.status !== 'on_hold') {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot modify items in a purchase order that is not pending or on hold' 
        });
      }
      
      // Check if item exists
      const itemResult = await client.query(
        'SELECT * FROM purchase_order_items WHERE item_id = $1 AND po_id = $2',
        [itemId, id]
      );
      
      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Item not found in this purchase order' });
      }
      
      // Calculate total price
      const total_price = parseFloat(quantity) * parseFloat(unit_price);
      
      // Update the item
      const updatedItemResult = await client.query(
        `UPDATE purchase_order_items 
         SET quantity = $1, unit_price = $2, total_price = $3
         WHERE item_id = $4 AND po_id = $5
         RETURNING *`,
        [quantity, unit_price, total_price, itemId, id]
      );
      
      // Update the total amount of the purchase order
      await client.query(
        `UPDATE purchase_orders 
         SET total_amount = (
           SELECT SUM(total_price) 
           FROM purchase_order_items 
           WHERE po_id = $1
         )
         WHERE po_id = $1`,
        [id]
      );
      
      await client.query('COMMIT');
      
      // Get part details to include in response
      const partResult = await this.pool.query(
        'SELECT name, manufacturer_part_number, fiserv_part_number FROM parts WHERE part_id = $1',
        [updatedItemResult.rows[0].part_id]
      );
      
      const item = {
        ...updatedItemResult.rows[0],
        part_name: partResult.rows[0]?.name,
        manufacturer_part_number: partResult.rows[0]?.manufacturer_part_number,
        fiserv_part_number: partResult.rows[0]?.fiserv_part_number
      };
      
      res.status(200).json(item);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating item in purchase order:', error);
      res.status(500).json({ message: 'Failed to update item in purchase order' });
    } finally {
      client.release();
    }
  }

  async createBlankPurchaseOrder(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      supplier_id, 
      notes = '', 
      is_urgent = false,
      next_day_air = false,
      shipping_cost = 0,
      tax_amount = 0,
      requested_by = '',
      approved_by = '',
      priority = 'Normal'
    } = req.body;

    console.log("Creating blank PO with data:", req.body);
    
    // Format the notes to include special fields
    const formattedNotes = JSON.stringify({
      original_notes: notes,
      is_urgent,
      next_day_air,
      shipping_cost,
      tax_amount,
      priority,
      requested_by,
      approved_by
    });
    
    let client;
    try {
      client = await this.pool.connect();

      // Begin transaction
      await client.query('BEGIN');

      // Generate PO number using date-based approach
      const currentDate = new Date();
      const poPrefix = format(currentDate, 'yyyyMM');
      
      // Get the latest PO number with this prefix
      const poNumResult = await client.query(
        "SELECT po_number FROM purchase_orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1",
        [`${poPrefix}%`]
      );
      
      let nextNum = 1;
      if (poNumResult.rows.length > 0) {
        try {
          // Extract the last number and increment with safer parsing
          const lastPO = poNumResult.rows[0].po_number;
          const parts = lastPO.split('-');
          if (parts.length >= 2) {
            const lastNumStr = parts[1];
            const lastNum = parseInt(lastNumStr);
            if (!isNaN(lastNum)) {
              nextNum = lastNum + 1;
            }
          }
        } catch (parseError) {
          console.error('Error parsing last PO number:', parseError);
          // Continue with default nextNum = 1
        }
      }
      
      const poNumber = `${poPrefix}-${nextNum.toString().padStart(4, '0')}`;
      console.log(`Generated PO number: ${poNumber}`);

      // Insert PO with blank status
      const insertPoResult = await client.query(
        `INSERT INTO purchase_orders (
          po_number, supplier_id, status, notes
        ) VALUES ($1, $2, $3, $4) RETURNING po_id`,
        [poNumber, supplier_id, 'pending', formattedNotes]
      );
      
      const poId = insertPoResult.rows[0].po_id;
      console.log(`Created blank PO with ID: ${poId}`);

      // Commit transaction
      await client.query('COMMIT');

      res.status(201).json({
        po_id: poId,
        po_number: poNumber,
        message: 'Blank purchase order created successfully'
      });
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error('Error creating blank purchase order:', err);
      res.status(500).json({ error: `Error creating blank purchase order: ${err.message}` });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Document management methods
  async getDocumentsByPurchaseOrderId(req, res) {
    const { id } = req.params;
    
    try {
      console.log(`Fetching documents for PO ID: ${id}`);
      
      // First, verify that the purchase order exists
      const poResult = await this.pool.query(
        'SELECT po_id FROM purchase_orders WHERE po_id = $1',
        [id]
      );
      
      if (poResult.rows.length === 0) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      
      // Retrieve documents
      const documents = await this.documentService.getDocumentsByPOId(id);
      console.log(`Found ${documents.length} documents for PO ID: ${id}`);
      
      return res.json(documents);
    } catch (error) {
      console.error(`Error retrieving documents for PO ID ${id}:`, error);
      return res.status(500).json({ error: `Failed to retrieve documents: ${error.message}` });
    }
  }
  
  async downloadDocument(req, res) {
    const { documentId } = req.params;
    
    try {
      console.log(`Downloading document ID: ${documentId}`);
      
      // Get document metadata
      const document = await this.documentService.getDocumentById(documentId);
      
      if (!document) {
        console.error(`Document ID ${documentId} not found in database`);
        return res.status(404).json({ error: 'Document not found' });
      }
      
      console.log(`Found document in database:`, {
        id: document.document_id,
        name: document.file_name,
        path: document.file_path,
        type: document.document_type
      });
      
      // Verify file exists before attempting to read it
      try {
        await fs.access(document.file_path);
        console.log(`Confirmed file exists at path: ${document.file_path}`);
      } catch (accessError) {
        console.error(`File access error for path ${document.file_path}:`, accessError);
        
        // Try an alternative path as a fallback
        const documentDir = this.documentService.documentDir;
        const alternativePath = path.join(documentDir, document.file_name);
        
        console.log(`Trying alternative path: ${alternativePath}`);
        try {
          await fs.access(alternativePath);
          console.log(`File found at alternative path, using it instead`);
          
          // Update the path in the document object for use below
          document.file_path = alternativePath;
          
          // Also update in database for future requests
          await this.pool.query(
            `UPDATE purchase_order_documents SET file_path = $1 WHERE document_id = $2`,
            [alternativePath, document.document_id]
          );
          console.log(`Updated database with corrected path`);
        } catch (altError) {
          console.error(`Alternative path also failed:`, altError);
          return res.status(404).json({ error: 'Document file not found on server' });
        }
      }
      
      // Get document content
      console.log(`Reading file content from: ${document.file_path}`);
      let fileContent;
      try {
        fileContent = await fs.readFile(document.file_path);
        console.log(`Successfully read file, size: ${fileContent.length} bytes`);
      } catch (readError) {
        console.error(`Error reading file:`, readError);
        return res.status(500).json({ error: `Failed to read document file: ${readError.message}` });
      }
      
      // Determine content type based on file extension
      const fileName = document.file_name;
      let contentType = 'application/octet-stream'; // Default
      
      if (fileName.endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        contentType = 'application/msword';
      } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        contentType = 'application/vnd.ms-excel';
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (fileName.endsWith('.png')) {
        contentType = 'image/png';
      }
      
      console.log(`Setting content type to: ${contentType}`);
      
      // Set headers for download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileContent.length);
      
      // Send file
      console.log(`Sending file to client`);
      return res.send(fileContent);
    } catch (error) {
      console.error(`Error downloading document ID ${documentId}:`, error);
      
      if (error.message === 'Document not found') {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      return res.status(500).json({ error: `Failed to download document: ${error.message}` });
    }
  }

  // Handle document uploads
  async uploadDocument(req, res) {
    const { id: poId } = req.params;
    const username = req.user?.username || 'system';
    
    try {
      console.log('Starting document upload for PO:', poId);
      
      // Configure multer for this specific request
      const uploader = upload.single('document');
      
      // Process upload using multer
      uploader(req, res, async (err) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        try {
          // Use the document service to handle the upload and extract text if it's a PDF
          const document = await this.documentService.uploadDocument(
            poId, 
            req.file, 
            username, 
            req.body.notes || ''
          );
          
          return res.status(201).json(document);
        } catch (error) {
          console.error('Document upload processing error:', error);
          return res.status(500).json({ error: error.message });
        }
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteDocument(req, res) {
    const { documentId } = req.params;
    
    try {
      console.log(`Deleting document ID: ${documentId}`);
      
      // Use the document service to handle the deletion
      await this.documentService.deleteDocument(documentId);
      
      res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error(`Error deleting document ID ${documentId}:`, error);
      if (error.message === 'Document not found') {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.status(500).json({ error: `Failed to delete document: ${error.message}` });
    }
  }
}

module.exports = PurchaseOrderController;
