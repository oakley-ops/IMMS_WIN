const Part = require('../models/Part');
const { body, validationResult } = require('express-validator'); 
const io = require('socket.io'); // Fix socket.io initialization
const { pool } = require('../../db'); // Use the global pool

class PartController {
  constructor(server) {
    this.pool = pool; // Use the global pool from db.js
    this.io = io(server); // Initialize socket.io with the server instance
  }

  async getAllParts(req, res) {
    try {
      // Update query to include primary supplier details
      const result = await this.pool.query(`
        SELECT p.*, s.name as supplier_name, 
          (SELECT supplier_id FROM part_suppliers WHERE part_id = p.part_id AND is_preferred = true LIMIT 1) AS preferred_supplier_id
        FROM parts p
        LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id AND ps.is_preferred = true
        LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching parts');
    }
  }

  async createPart(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      quantity,
      manufacturer_part_number,
      fiserv_part_number,
      machine_id,
      location,
      minimum_quantity,
      unit_cost,
      status,
      notes,
      supplier_id, // This will be the primary supplier ID if specified
    } = req.body;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create the part without a direct supplier reference
      const partResult = await client.query(
        `INSERT INTO parts (
          name, description, quantity, manufacturer_part_number, 
          fiserv_part_number, machine_id, location, minimum_quantity, 
          unit_cost, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          name,
          description,
          quantity,
          manufacturer_part_number,
          fiserv_part_number,
          machine_id,
          location,
          minimum_quantity || 0,
          unit_cost || 0,
          status || 'active',
          notes
        ]
      );
      
      const newPart = partResult.rows[0];
      
      // If a supplier was specified, create the part-supplier relationship
      if (supplier_id) {
        await client.query(
          `INSERT INTO part_suppliers (part_id, supplier_id, is_preferred, unit_cost) 
           VALUES ($1, $2, true, $3)`,
          [newPart.part_id, supplier_id, unit_cost || 0]
        );
      }
      
      await client.query('COMMIT');
      
      // Get the full part data with supplier information
      const finalResult = await client.query(`
        SELECT p.*, s.name as supplier_name
        FROM parts p
        LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id AND ps.is_preferred = true
        LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
        WHERE p.part_id = $1
      `, [newPart.part_id]);
      
      res.status(201).json(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error creating part');
    } finally {
      client.release();
    }
  }

  async updatePart(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      description,
      quantity,
      manufacturer_part_number,
      fiserv_part_number,
      machine_id,
      location,
      minimum_quantity,
      unit_cost,
      status,
      notes,
      supplier_id, // This can be updated to change the preferred supplier
    } = req.body;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update the part itself
      const result = await client.query(
        `UPDATE parts 
         SET name = $1, description = $2, quantity = $3, manufacturer_part_number = $4,
             fiserv_part_number = $5, machine_id = $6, location = $7, minimum_quantity = $8,
             unit_cost = $9, status = $10, notes = $11
         WHERE part_id = $12 RETURNING *`,
        [
          name,
          description,
          quantity,
          manufacturer_part_number,
          fiserv_part_number,
          machine_id,
          location,
          minimum_quantity,
          unit_cost,
          status,
          notes,
          id
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Part not found' });
      }

      // If a supplier_id is provided, update the preferred supplier
      if (supplier_id) {
        // First, reset any existing preferred status
        await client.query(
          `UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1`,
          [id]
        );

        // Check if this supplier is already associated with the part
        const supplierCheck = await client.query(
          `SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2`,
          [id, supplier_id]
        );

        if (supplierCheck.rows.length > 0) {
          // Update existing relationship to preferred
          await client.query(
            `UPDATE part_suppliers SET is_preferred = true, unit_cost = $3 
             WHERE part_id = $1 AND supplier_id = $2`,
            [id, supplier_id, unit_cost]
          );
        } else {
          // Create new relationship as preferred
          await client.query(
            `INSERT INTO part_suppliers (part_id, supplier_id, is_preferred, unit_cost) 
             VALUES ($1, $2, true, $3)`,
            [id, supplier_id, unit_cost]
          );
        }
      }

      await client.query('COMMIT');

      // Get the full part data with supplier information
      const finalResult = await client.query(`
        SELECT p.*, s.name as supplier_name
        FROM parts p
        LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id AND ps.is_preferred = true
        LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
        WHERE p.part_id = $1
      `, [id]);
      
      res.json(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error updating part');
    } finally {
      client.release();
    }
  }

  async getPartById(req, res) {
    const { id } = req.params;
    try {
      // Get the part with its preferred supplier
      const partResult = await this.pool.query(`
        SELECT p.*, s.name as supplier_name
        FROM parts p
        LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id AND ps.is_preferred = true
        LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
        WHERE p.part_id = $1
      `, [id]);

      if (partResult.rows.length === 0) {
        return res.status(404).json({ message: 'Part not found' });
      }

      // Get all suppliers for this part
      const suppliersResult = await this.pool.query(`
        SELECT s.*, ps.is_preferred, ps.unit_cost, ps.lead_time_days, ps.minimum_order_quantity, ps.notes as supplier_notes
        FROM suppliers s
        JOIN part_suppliers ps ON s.supplier_id = ps.supplier_id
        WHERE ps.part_id = $1
        ORDER BY ps.is_preferred DESC, s.name
      `, [id]);

      const part = partResult.rows[0];
      part.suppliers = suppliersResult.rows;

      res.json(part);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching part');
    }
  }

  async deletePart(req, res) {
    const { id } = req.params;
    try {
      // The part_suppliers records will be deleted automatically due to the ON DELETE CASCADE constraint
      const result = await this.pool.query(
        'DELETE FROM parts WHERE part_id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Part not found' });
      }

      res.json({ message: 'Part deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error deleting part');
    }
  }

  // New method to get all suppliers for a part
  async getPartSuppliers(req, res) {
    const { id } = req.params;
    try {
      // Check if part exists
      const partCheck = await this.pool.query(
        'SELECT * FROM parts WHERE part_id = $1',
        [id]
      );

      if (partCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Part not found' });
      }

      // Get all suppliers for this part
      const result = await this.pool.query(`
        SELECT s.*, ps.is_preferred, ps.unit_cost, ps.lead_time_days, ps.minimum_order_quantity, ps.notes as supplier_notes
        FROM suppliers s
        JOIN part_suppliers ps ON s.supplier_id = ps.supplier_id
        WHERE ps.part_id = $1
        ORDER BY ps.is_preferred DESC, s.name
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching part suppliers');
    }
  }

  // New method to add a supplier to a part
  async addPartSupplier(req, res) {
    const { id } = req.params; // part_id
    const { 
      supplier_id, 
      is_preferred = false, 
      unit_cost,
      lead_time_days,
      minimum_order_quantity,
      notes 
    } = req.body;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if part exists
      const partCheck = await client.query(
        'SELECT * FROM parts WHERE part_id = $1',
        [id]
      );

      if (partCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Part not found' });
      }

      // Check if supplier exists
      const supplierCheck = await client.query(
        'SELECT * FROM suppliers WHERE supplier_id = $1',
        [supplier_id]
      );

      if (supplierCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Supplier not found' });
      }

      // Check if relationship already exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [id, supplier_id]
      );

      if (relationCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'This supplier is already associated with this part' });
      }

      // If this will be the preferred supplier, update any existing preferred supplier
      if (is_preferred) {
        await client.query(
          'UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1',
          [id]
        );
      }

      // Create the relationship
      const result = await client.query(
        `INSERT INTO part_suppliers (part_id, supplier_id, is_preferred, unit_cost, lead_time_days, minimum_order_quantity, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, supplier_id, is_preferred, unit_cost, lead_time_days, minimum_order_quantity || 1, notes]
      );

      // If no unit_cost is specified but the part has a unit_cost, update the part_suppliers record
      if (!unit_cost && partCheck.rows[0].unit_cost) {
        await client.query(
          'UPDATE part_suppliers SET unit_cost = $1 WHERE part_id = $2 AND supplier_id = $3',
          [partCheck.rows[0].unit_cost, id, supplier_id]
        );
      }

      await client.query('COMMIT');

      // Get the full supplier details
      const finalResult = await client.query(`
        SELECT s.*, ps.is_preferred, ps.unit_cost, ps.lead_time_days, ps.minimum_order_quantity, ps.notes as supplier_notes
        FROM suppliers s
        JOIN part_suppliers ps ON s.supplier_id = ps.supplier_id
        WHERE ps.part_id = $1 AND s.supplier_id = $2
      `, [id, supplier_id]);

      res.status(201).json(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error adding supplier to part');
    } finally {
      client.release();
    }
  }

  // New method to update a part-supplier relationship
  async updatePartSupplier(req, res) {
    const { id, supplierId } = req.params; // part_id, supplier_id
    const { 
      is_preferred = false, 
      unit_cost,
      lead_time_days,
      minimum_order_quantity,
      notes 
    } = req.body;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if the relationship exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      if (relationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Supplier is not associated with this part' });
      }

      // If this will be the preferred supplier, update any existing preferred supplier
      if (is_preferred) {
        await client.query(
          'UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1',
          [id]
        );
      }

      // Update the relationship
      await client.query(
        `UPDATE part_suppliers 
         SET is_preferred = $3, unit_cost = $4, lead_time_days = $5, minimum_order_quantity = $6, notes = $7
         WHERE part_id = $1 AND supplier_id = $2`,
        [id, supplierId, is_preferred, unit_cost, lead_time_days, minimum_order_quantity, notes]
      );

      await client.query('COMMIT');

      // Get the updated supplier details
      const result = await client.query(`
        SELECT s.*, ps.is_preferred, ps.unit_cost, ps.lead_time_days, ps.minimum_order_quantity, ps.notes as supplier_notes
        FROM suppliers s
        JOIN part_suppliers ps ON s.supplier_id = ps.supplier_id
        WHERE ps.part_id = $1 AND s.supplier_id = $2
      `, [id, supplierId]);

      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error updating part-supplier relationship');
    } finally {
      client.release();
    }
  }

  // New method to remove a supplier from a part
  async removePartSupplier(req, res) {
    const { id, supplierId } = req.params; // part_id, supplier_id

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if the relationship exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      if (relationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Supplier is not associated with this part' });
      }

      // Check if this is the only supplier for this part
      const countCheck = await client.query(
        'SELECT COUNT(*) FROM part_suppliers WHERE part_id = $1',
        [id]
      );

      if (parseInt(countCheck.rows[0].count) === 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Cannot remove the only supplier for this part. Please add another supplier first or delete the part entirely.' 
        });
      }

      // Check if this is the preferred supplier
      if (relationCheck.rows[0].is_preferred) {
        // Find another supplier to make preferred
        const otherSupplier = await client.query(
          'SELECT supplier_id FROM part_suppliers WHERE part_id = $1 AND supplier_id != $2 LIMIT 1',
          [id, supplierId]
        );
        
        if (otherSupplier.rows.length > 0) {
          // Mark the first other supplier as preferred
          const newPreferredSupplierId = otherSupplier.rows[0].supplier_id;
          await client.query(
            'UPDATE part_suppliers SET is_preferred = true WHERE part_id = $1 AND supplier_id = $2',
            [id, newPreferredSupplierId]
          );
          
          // Update the part's supplier_id
          await client.query(
            'UPDATE parts SET supplier_id = $1 WHERE part_id = $2',
            [newPreferredSupplierId, id]
          );
        } else {
          // No other suppliers, clear the part's supplier_id
          await client.query(
            'UPDATE parts SET supplier_id = NULL WHERE part_id = $1',
            [id]
          );
        }
      }

      // Remove the relationship
      await client.query(
        'DELETE FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [id, supplierId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Supplier successfully removed from this part' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).send('Error removing supplier from part');
    } finally {
      client.release();
    }
  }

  // Get low-stock parts with their preferred suppliers
  async getLowStockParts(req, res) {
    try {
      const result = await this.pool.query(`
        SELECT p.*, 
               s.name as supplier_name, 
               s.supplier_id, 
               ps.unit_cost as supplier_unit_cost,
               ps.lead_time_days,
               ps.minimum_order_quantity
        FROM parts p
        LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id
        LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
        WHERE p.quantity <= p.minimum_quantity
        ORDER BY p.quantity ASC, ps.is_preferred DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching low stock parts');
    }
  }

  // Get all suppliers for a part
  async getSuppliersForPart(req, res) {
    const partId = req.params.id;
    
    try {
      // First check if part exists
      const partCheck = await this.pool.query('SELECT * FROM parts WHERE part_id = $1', [partId]);
      
      if (partCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }
      
      // Get suppliers for the part
      const result = await this.pool.query(`
        SELECT ps.*, s.name as supplier_name, s.contact_name, s.email, s.phone, s.address
        FROM part_suppliers ps
        JOIN suppliers s ON ps.supplier_id = s.supplier_id
        WHERE ps.part_id = $1
        ORDER BY ps.is_preferred DESC, s.name
      `, [partId]);
      
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching suppliers for part:', error);
      res.status(500).json({ error: 'Error fetching suppliers for part' });
    }
  }
  
  // Add a supplier to a part
  async addSupplierToPart(req, res) {
    const partId = req.params.id;
    const { supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes } = req.body;
    
    if (!supplier_id || unit_cost === undefined) {
      return res.status(400).json({ error: 'Supplier ID and unit cost are required' });
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if part exists
      const partCheck = await client.query('SELECT * FROM parts WHERE part_id = $1', [partId]);
      
      if (partCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Part not found' });
      }
      
      // Check if supplier exists
      const supplierCheck = await client.query('SELECT * FROM suppliers WHERE supplier_id = $1', [supplier_id]);
      
      if (supplierCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      // Check if relationship already exists
      const existingRelation = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [partId, supplier_id]
      );
      
      if (existingRelation.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This supplier is already associated with this part' });
      }
      
      // If this is marked as preferred, clear other preferred suppliers
      if (is_preferred) {
        await client.query(
          'UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1',
          [partId]
        );
      }
      
      // Add the new part-supplier relationship
      const result = await client.query(`
        INSERT INTO part_suppliers 
        (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *, (SELECT name FROM suppliers WHERE supplier_id = $2) as supplier_name
      `, [
        partId, 
        supplier_id, 
        unit_cost, 
        is_preferred || false, 
        lead_time_days || null, 
        minimum_order_quantity || 1, 
        notes || null
      ]);
      
      // If this is the only supplier or marked as preferred, update the part's supplier_id
      if (is_preferred || existingRelation.rows.length === 0) {
        await client.query(
          'UPDATE parts SET supplier_id = $1 WHERE part_id = $2',
          [supplier_id, partId]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding supplier to part:', error);
      res.status(500).json({ error: 'Error adding supplier to part' });
    } finally {
      client.release();
    }
  }
  
  // Update a part-supplier relationship
  async updatePartSupplier(req, res) {
    const partId = req.params.partId;
    const supplierId = req.params.supplierId;
    const { unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes } = req.body;
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the relationship exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [partId, supplierId]
      );
      
      if (relationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Part-supplier relationship not found' });
      }
      
      // If marked as preferred, clear other preferred suppliers
      if (is_preferred) {
        await client.query(
          'UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1',
          [partId]
        );
      }
      
      // Update the relationship
      const result = await client.query(`
        UPDATE part_suppliers
        SET unit_cost = $3, is_preferred = $4, lead_time_days = $5, minimum_order_quantity = $6, notes = $7
        WHERE part_id = $1 AND supplier_id = $2
        RETURNING *, (SELECT name FROM suppliers WHERE supplier_id = $2) as supplier_name
      `, [
        partId,
        supplierId,
        unit_cost,
        is_preferred || false,
        lead_time_days || null,
        minimum_order_quantity || 1,
        notes || null
      ]);
      
      // If marked as preferred, update the part's supplier_id
      if (is_preferred) {
        await client.query(
          'UPDATE parts SET supplier_id = $1 WHERE part_id = $2',
          [supplierId, partId]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating part-supplier relationship:', error);
      res.status(500).json({ error: 'Error updating part-supplier relationship' });
    } finally {
      client.release();
    }
  }
  
  // Remove a supplier from a part
  async removeSupplierFromPart(req, res) {
    const partId = req.params.partId;
    const supplierId = req.params.supplierId;
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the relationship exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [partId, supplierId]
      );
      
      if (relationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Part-supplier relationship not found' });
      }
      
      // Check if this is the preferred supplier
      const isPreferred = relationCheck.rows[0].is_preferred;
      
      // Delete the relationship
      await client.query(
        'DELETE FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [partId, supplierId]
      );
      
      // If this was the preferred supplier, find another supplier to mark as preferred
      if (isPreferred) {
        const otherSuppliers = await client.query(
          'SELECT supplier_id FROM part_suppliers WHERE part_id = $1 ORDER BY created_at LIMIT 1',
          [partId]
        );
        
        if (otherSuppliers.rows.length > 0) {
          // Mark the first other supplier as preferred
          const newPreferredSupplierId = otherSuppliers.rows[0].supplier_id;
          await client.query(
            'UPDATE part_suppliers SET is_preferred = true WHERE part_id = $1 AND supplier_id = $2',
            [partId, newPreferredSupplierId]
          );
          
          // Update the part's supplier_id
          await client.query(
            'UPDATE parts SET supplier_id = $1 WHERE part_id = $2',
            [newPreferredSupplierId, partId]
          );
        } else {
          // No other suppliers, clear the part's supplier_id
          await client.query(
            'UPDATE parts SET supplier_id = NULL WHERE part_id = $1',
            [partId]
          );
        }
      }
      
      await client.query('COMMIT');
      
      res.status(200).json({ message: 'Supplier removed from part successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error removing supplier from part:', error);
      res.status(500).json({ error: 'Error removing supplier from part' });
    } finally {
      client.release();
    }
  }
  
  // Set a supplier as preferred for a part
  async setPreferredSupplier(req, res) {
    const partId = req.params.partId;
    const supplierId = req.params.supplierId;
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the relationship exists
      const relationCheck = await client.query(
        'SELECT * FROM part_suppliers WHERE part_id = $1 AND supplier_id = $2',
        [partId, supplierId]
      );
      
      if (relationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Part-supplier relationship not found' });
      }
      
      // Clear any existing preferred flag
      await client.query(
        'UPDATE part_suppliers SET is_preferred = false WHERE part_id = $1',
        [partId]
      );
      
      // Set the specified supplier as preferred
      const result = await client.query(`
        UPDATE part_suppliers 
        SET is_preferred = true 
        WHERE part_id = $1 AND supplier_id = $2
        RETURNING *, (SELECT name FROM suppliers WHERE supplier_id = $2) as supplier_name
      `, [partId, supplierId]);
      
      // Update the part's supplier_id
      await client.query(
        'UPDATE parts SET supplier_id = $1 WHERE part_id = $2',
        [supplierId, partId]
      );
      
      await client.query('COMMIT');
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error setting preferred supplier:', error);
      res.status(500).json({ error: 'Error setting preferred supplier' });
    } finally {
      client.release();
    }
  }
}

module.exports = PartController;