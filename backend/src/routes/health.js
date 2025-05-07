const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    
    // Basic health metrics
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      },
      activeUsers: Object.values(global.activeUsers || {}).reduce((total, device) => total + device.size, 0)
    };
    
    res.json(healthInfo);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: process.env.NODE_ENV === 'production' ? 'Service unavailable' : error.message
    });
  }
});

module.exports = router; 