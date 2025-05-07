const db = require('../../db');
const excel = require('exceljs');
const path = require('path');
const emailService = require('../services/emailService');

class PartsUsageController {
  constructor(io) {
    this.io = io;
  }

  async recordUsage(req, res) {
    const { part_id, quantity, reason, work_order_number } = req.body;
    
    // Validate input
    if (!part_id || !quantity) {
      return res.status(400).json({ error: 'Part ID and quantity are required' });
    }
    
    try {
      // First, check that the part exists and has enough quantity
      const partResult = await db.query(
        'SELECT * FROM parts WHERE part_id = $1',
        [part_id]
      );
      
      if (partResult.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }
      
      const part = partResult.rows[0];
      
      if (part.quantity < quantity) {
        return res.status(400).json({ 
          error: 'Insufficient quantity',
          available: part.quantity,
          requested: quantity
        });
      }
      
      // Start a transaction
      await db.query('BEGIN');
      
      try {
        // Update the part quantity
        await db.query(
          'UPDATE parts SET quantity = quantity - $1 WHERE part_id = $2',
          [quantity, part_id]
        );
        
        // Record the transaction in the transactions table
        const notes = reason || 'Part used';
        const transactionResult = await db.query(
          `INSERT INTO transactions (
            part_id, 
            quantity, 
            type, 
            notes,
            reference_number
          ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [part_id, quantity, 'usage', notes, work_order_number]
        );
        
        await db.query('COMMIT');
        
        // Emit an update event
        this.io.emit('inventory-updated', {
          type: 'usage',
          part_id: part_id,
          quantity: quantity
        });
        
        // Return the result
        res.status(200).json({
          success: true,
          message: 'Part usage recorded successfully',
          transaction: transactionResult.rows[0]
        });
        
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error recording part usage:', error);
      res.status(500).json({ 
        error: 'Failed to record part usage',
        details: error.message
      });
    }
  }

  async getUsageHistory(req, res) {
    try {
      let query = `
        SELECT 
          pu.usage_id,
          pu.usage_date,
          p.name as part_name,
          p.fiserv_part_number,
          m.name as machine_name,
          pu.quantity
        FROM parts_usage pu
        JOIN parts p ON p.part_id = pu.part_id
        JOIN machines m ON m.machine_id = pu.machine_id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (req.query.startDate) {
        params.push(req.query.startDate);
        query += ` AND pu.usage_date >= $${params.length}`;
      }
      
      if (req.query.endDate) {
        params.push(req.query.endDate);
        query += ` AND pu.usage_date <= $${params.length}`;
      }
      
      query += ' ORDER BY pu.usage_date DESC';

      console.log('Executing query:', query, params);
      const result = await db.query(query, params);
      console.log('Query result:', result.rows);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching parts usage:', error);
      res.status(500).json({ 
        error: 'Error fetching parts usage',
        details: error.message 
      });
    }
  }

  async exportToExcel(req, res) {
    try {
      let query = `
        SELECT 
          pu.usage_date,
          p.name as part_name,
          p.fiserv_part_number,
          m.name as machine_name,
          pu.quantity
        FROM parts_usage pu
        JOIN parts p ON p.part_id = pu.part_id
        JOIN machines m ON m.machine_id = pu.machine_id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (req.query.startDate) {
        params.push(req.query.startDate);
        query += ` AND pu.usage_date >= $${params.length}`;
      }
      
      if (req.query.endDate) {
        params.push(req.query.endDate);
        query += ` AND pu.usage_date <= $${params.length}`;
      }
      
      query += ' ORDER BY pu.usage_date DESC';

      const result = await db.query(query, params);

      const workbook = new excel.Workbook();
      const worksheet = workbook.addWorksheet('Parts Usage');

      worksheet.columns = [
        { header: 'Date', key: 'usage_date', width: 15 },
        { header: 'Part', key: 'part_name', width: 30 },
        { header: 'Fiserv Part #', key: 'fiserv_part_number', width: 15 },
        { header: 'Machine', key: 'machine_name', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 }
      ];

      // Format the dates and add the data
      result.rows.forEach(row => {
        worksheet.addRow({
          ...row,
          usage_date: new Date(row.usage_date).toLocaleDateString()
        });
      });

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Set the response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=parts-usage-report.xlsx'
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).json({ 
        error: 'Error exporting to Excel',
        details: error.message 
      });
    }
  }
}

module.exports = PartsUsageController;
