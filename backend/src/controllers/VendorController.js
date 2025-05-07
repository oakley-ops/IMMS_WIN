const Vendor = require('../models/Vendor');
const { pool } = require('../../db');
const { body, validationResult } = require('express-validator');

class VendorController {
  constructor() {
    // Use the shared pool instance from db.js instead of creating a new one
    this.pool = pool;
  }

  async getAllVendors(req, res) {
    try {
      const result = await this.pool.query('SELECT * FROM vendors ORDER BY name');
      const vendors = result.rows.map(
        (row) =>
          new Vendor(
            row.vendor_id,
            row.name,
            row.contact_name,
            row.email,
            row.phone,
            row.address,
            row.notes
          )
      );
      res.json(vendors);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching vendors');
    }
  }

  async getVendorById(req, res) {
    const vendorId = parseInt(req.params.id);

    try {
      const result = await this.pool.query(
        'SELECT * FROM vendors WHERE vendor_id = $1',
        [vendorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).send('Vendor not found');
      }

      const row = result.rows[0];
      const vendor = new Vendor(
        row.vendor_id,
        row.name,
        row.contact_name,
        row.email,
        row.phone,
        row.address,
        row.notes
      );

      res.json(vendor);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching vendor');
    }
  }

  async createVendor(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      contact_name,
      email,
      phone,
      address,
      notes,
    } = req.body;

    try {
      const result = await this.pool.query(
        `INSERT INTO vendors (name, contact_name, email, phone, address, notes) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, contact_name, email, phone, address, notes]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error creating vendor');
    }
  }

  async updateVendor(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const vendorId = parseInt(req.params.id);
    const {
      name,
      contact_name,
      email,
      phone,
      address,
      notes,
    } = req.body;

    try {
      const result = await this.pool.query(
        `UPDATE vendors 
         SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, notes = $6, updated_at = CURRENT_TIMESTAMP 
         WHERE vendor_id = $7 RETURNING *`,
        [name, contact_name, email, phone, address, notes, vendorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).send('Vendor not found');
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error updating vendor');
    }
  }

  async deleteVendor(req, res) {
    const vendorId = parseInt(req.params.id);

    try {
      const result = await this.pool.query(
        'DELETE FROM vendors WHERE vendor_id = $1 RETURNING *',
        [vendorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).send('Vendor not found');
      }

      res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error deleting vendor');
    }
  }

  getValidationRules() {
    return [
      body('name').not().isEmpty().withMessage('Vendor name is required'),
      body('email').optional().isEmail().withMessage('Must be a valid email address'),
      body('phone').optional(),
      body('address').optional(),
      body('notes').optional(),
    ];
  }
}

module.exports = VendorController;
