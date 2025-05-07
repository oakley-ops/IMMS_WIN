const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Test email endpoint
router.post('/email', async (req, res) => {
  try {
    const testPart = {
      name: 'Test Part',
      fiserv_part_number: 'TEST-123',
      quantity: 2,
      minimum_quantity: 5,
      location: 'Warehouse A'
    };

    // Test both types of notifications
    await emailService.sendLowStockNotification(testPart);
    await emailService.sendOutOfStockNotification({...testPart, quantity: 0});

    res.json({ message: 'Test emails sent successfully' });
  } catch (error) {
    console.error('Error sending test emails:', error);
    res.status(500).json({ error: 'Failed to send test emails', details: error.message });
  }
});

module.exports = router; 