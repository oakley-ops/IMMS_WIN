const Transaction = require('../models/Transaction');
const { Pool } = require('pg');
const dbConfig = require('../../config/database');

class TransactionController {
  constructor() {
    console.log('TransactionController initialized');
    const env = process.env.NODE_ENV || 'development';
    const config = dbConfig[env];
    console.log('Using database config for environment:', env);
    console.log('Database config:', { ...config, password: '****' });

    this.pool = new Pool(config);

    // Test database connection
    this.pool.connect()
      .then(() => console.log('TransactionController: Database connected successfully'))
      .catch(err => console.error('TransactionController: Database connection error:', err));

    // Bind methods to instance
    this.getAllTransactions = this.getAllTransactions.bind(this);
  }

  async getAllTransactions(req, res) {
    console.log('getAllTransactions called');
    console.log('Request query:', req.query);
    
    try {
      const { startDate, endDate } = req.query;
      let query = `
        SELECT 
          t.*,
          p.name as part_name,
          p.manufacturer_part_number,
          p.fiserv_part_number,
          m.name as machine_name
        FROM transactions t
        LEFT JOIN parts p ON t.part_id = p.part_id
        LEFT JOIN machines m ON p.machine_id = m.machine_id
      `;
      const queryParams = [];

      if (startDate || endDate) {
        query += ' WHERE ';
        const conditions = [];

        if (startDate) {
          conditions.push('t.date >= $' + (queryParams.length + 1));
          queryParams.push(startDate);
        }

        if (endDate) {
          conditions.push('t.date <= $' + (queryParams.length + 1));
          queryParams.push(endDate);
        }

        query += conditions.join(' AND ');
      }

      query += ' ORDER BY t.date DESC';

      console.log('Query:', query);
      console.log('Params:', queryParams);

      const result = await this.pool.query(query, queryParams);
      console.log('Found', result.rows.length, 'transactions');
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ 
        error: 'Error fetching transactions',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // ... other methods for create, update (if needed), delete
}

module.exports = TransactionController;