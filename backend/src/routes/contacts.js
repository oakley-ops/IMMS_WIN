const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../middleware/authMiddleware');
const roleAuthorization = require('../middleware/roleMiddleware');

// Define role permissions for contact routes
const ROLES = {
  ALL: ['admin', 'tech', 'purchasing'],
  ADMIN_TECH: ['admin', 'tech'],
  ADMIN_ONLY: ['admin']
};

// Get all contacts
router.get('/', authMiddleware, roleAuthorization(ROLES.ALL), async (req, res) => {
  try {
    const { type, status } = req.query;
    
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];
    
    if (type && type !== 'all') {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY company ASC, name ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get contact by ID
router.get('/:id', authMiddleware, roleAuthorization(ROLES.ALL), async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }
    
    const result = await pool.query(
      'SELECT * FROM contacts WHERE contact_id = $1',
      [contactId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching contact:', err);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create new contact
router.post('/', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), async (req, res) => {
  try {
    const {
      name,
      company,
      type,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      notes,
      status
    } = req.body;
    
    // Validate required fields
    if (!name || !company || !type || !email || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, company, type, email, phone' 
      });
    }
    
    // Validate type
    if (!['vendor', 'contractor', 'supplier'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be vendor, contractor, or supplier' 
      });
    }
    
    // Validate status
    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be active or inactive' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO contacts (
        name, company, type, email, phone, address, city, state, zip_code, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING *`,
      [
        name,
        company,
        type,
        email,
        phone,
        address || null,
        city || null,
        state || null,
        zip_code || null,
        notes || null,
        status || 'active'
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating contact:', err);
    
    if (err.code === '23505' && err.constraint === 'unique_contact_email') {
      res.status(400).json({ error: 'Email address already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create contact' });
    }
  }
});

// Update contact
router.put('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }
    
    const {
      name,
      company,
      type,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      notes,
      status
    } = req.body;
    
    // Validate type if provided
    if (type && !['vendor', 'contractor', 'supplier'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be vendor, contractor, or supplier' 
      });
    }
    
    // Validate status if provided
    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be active or inactive' 
      });
    }
    
    // Check if contact exists
    const checkResult = await pool.query(
      'SELECT contact_id FROM contacts WHERE contact_id = $1',
      [contactId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const result = await pool.query(
      `UPDATE contacts SET
        name = COALESCE($1, name),
        company = COALESCE($2, company),
        type = COALESCE($3, type),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        address = COALESCE($6, address),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        zip_code = COALESCE($9, zip_code),
        notes = COALESCE($10, notes),
        status = COALESCE($11, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE contact_id = $12
      RETURNING *`,
      [
        name,
        company,
        type,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        notes,
        status,
        contactId
      ]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating contact:', err);
    
    if (err.code === '23505' && err.constraint === 'unique_contact_email') {
      res.status(400).json({ error: 'Email address already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update contact' });
    }
  }
});

// Delete contact
router.delete('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }
    
    const result = await pool.query(
      'DELETE FROM contacts WHERE contact_id = $1 RETURNING *',
      [contactId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ 
      message: 'Contact deleted successfully',
      contact: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Get contact statistics
router.get('/stats/summary', authMiddleware, roleAuthorization(ROLES.ALL), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(*) FILTER (WHERE type = 'vendor') as total_vendors,
        COUNT(*) FILTER (WHERE type = 'contractor') as total_contractors,
        COUNT(*) FILTER (WHERE type = 'supplier') as total_suppliers,
        COUNT(*) FILTER (WHERE status = 'active') as active_contacts,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_contacts
      FROM contacts
    `);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching contact statistics:', err);
    res.status(500).json({ error: 'Failed to fetch contact statistics' });
  }
});

// Search contacts
router.get('/search/:query', authMiddleware, roleAuthorization(ROLES.ALL), async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const result = await pool.query(
      `SELECT * FROM contacts 
       WHERE 
         name ILIKE $1 OR 
         company ILIKE $1 OR 
         email ILIKE $1 OR
         phone ILIKE $1
       ORDER BY company ASC, name ASC`,
      [`%${searchQuery}%`]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching contacts:', err);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

module.exports = router;
