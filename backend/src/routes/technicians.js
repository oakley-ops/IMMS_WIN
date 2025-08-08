const express = require('express');
const router = express.Router();
const TechniciansController = require('../controllers/TechniciansController');
const authMiddleware = require('../middleware/authMiddleware');
const roleAuthorization = require('../middleware/roleMiddleware');

// Define role permissions
const ROLES = {
  ALL: ['admin', 'tech', 'purchasing'],
  ADMIN_TECH: ['admin', 'tech'],
  ADMIN_ONLY: ['admin']
};

// GET /api/v1/technicians - Get all active technicians (for PM dropdown)
router.get('/', authMiddleware, roleAuthorization(ROLES.ALL), TechniciansController.getTechnicians);

// GET /api/v1/technicians/all - Get all technicians including inactive (for admin management)
router.get('/all', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), TechniciansController.getAllTechnicians);

// GET /api/v1/technicians/:id - Get a specific technician
router.get('/:id', authMiddleware, roleAuthorization(ROLES.ALL), TechniciansController.getTechnician);

// POST /api/v1/technicians - Create a new technician
router.post('/', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), TechniciansController.createTechnician);

// PUT /api/v1/technicians/:id - Update a technician
router.put('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), TechniciansController.updateTechnician);

// DELETE /api/v1/technicians/:id - Deactivate a technician
router.delete('/:id', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), TechniciansController.deleteTechnician);

// POST /api/v1/technicians/:id/reactivate - Reactivate a technician
router.post('/:id/reactivate', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), TechniciansController.reactivateTechnician);

module.exports = router; 