const { pool } = require('../../db');

class SupplierController {
  // Create a new supplier
  async createSupplier(req, res) {
    try {
      const { name, contact_name, email, phone, address, notes } = req.body;
      
      const result = await pool.query(
        'INSERT INTO suppliers (name, contact_name, email, phone, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, contact_name, email, phone, address, notes]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }

  // Get all suppliers
  async getAllSuppliers(req, res) {
    try {
      const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
      
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error retrieving suppliers:', error);
      res.status(500).json({ error: 'Failed to retrieve suppliers' });
    }
  }

  // Get supplier by ID
  async getSupplierById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await pool.query('SELECT * FROM suppliers WHERE supplier_id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error retrieving supplier:', error);
      res.status(500).json({ error: 'Failed to retrieve supplier' });
    }
  }

  // Update supplier
  async updateSupplier(req, res) {
    try {
      const { id } = req.params;
      const { name, contact_name, email, phone, address, notes } = req.body;
      
      const result = await pool.query(
        'UPDATE suppliers SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, notes = $6 WHERE supplier_id = $7 RETURNING *',
        [name, contact_name, email, phone, address, notes, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  }

  // Delete supplier
  async deleteSupplier(req, res) {
    try {
      const { id } = req.params;
      
      // Check if the supplier is associated with parts
      const partResult = await pool.query(
        'SELECT COUNT(*) FROM part_suppliers WHERE supplier_id = $1',
        [id]
      );
      
      if (parseInt(partResult.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete supplier because it is associated with parts. Remove supplier associations from parts first.' 
        });
      }
      
      // Check if the supplier is associated with purchase orders
      const poResult = await pool.query(
        'SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = $1',
        [id]
      );
      
      if (parseInt(poResult.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete supplier because it is associated with purchase orders.' 
        });
      }
      
      const result = await pool.query('DELETE FROM suppliers WHERE supplier_id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      res.status(200).json({ message: 'Supplier deleted successfully' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  }

  // Get parts by supplier
  async getPartsBySupplier(req, res) {
    try {
      const { id } = req.params;
      
      // First check if the supplier exists
      const supplierResult = await pool.query('SELECT * FROM suppliers WHERE supplier_id = $1', [id]);
      
      if (supplierResult.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      // Get all parts associated with this supplier
      const result = await pool.query(`
        SELECT p.*, ps.unit_cost, ps.lead_time_days, ps.minimum_order_quantity, ps.is_preferred 
        FROM parts p
        JOIN part_suppliers ps ON p.part_id = ps.part_id
        WHERE ps.supplier_id = $1
        ORDER BY p.name
      `, [id]);
      
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error retrieving parts by supplier:', error);
      res.status(500).json({ error: 'Failed to retrieve parts by supplier' });
    }
  }
}

module.exports = new SupplierController();
