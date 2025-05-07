const express = require('express');
const SupplierController = require('../controllers/SupplierController');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication middleware to all supplier routes
router.use(authenticate);

// CRUD operations
router.post('/', SupplierController.createSupplier);
router.get('/', SupplierController.getAllSuppliers);
router.get('/:id', SupplierController.getSupplierById);
router.put('/:id', SupplierController.updateSupplier);
router.delete('/:id', SupplierController.deleteSupplier);

// Get parts by supplier
router.get('/:id/parts', SupplierController.getPartsBySupplier);

module.exports = router;
