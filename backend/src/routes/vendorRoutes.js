const express = require('express');
const VendorController = require('../controllers/VendorController');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();
const vendorController = new VendorController();

// GET all vendors
router.get('/', authenticate, vendorController.getAllVendors.bind(vendorController));

// GET vendor by ID
router.get('/:id', authenticate, vendorController.getVendorById.bind(vendorController));

// POST create vendor
router.post(
  '/',
  authenticate,
  vendorController.getValidationRules(),
  vendorController.createVendor.bind(vendorController)
);

// PUT update vendor
router.put(
  '/:id',
  authenticate,
  vendorController.getValidationRules(),
  vendorController.updateVendor.bind(vendorController)
);

// DELETE vendor
router.delete(
  '/:id',
  authenticate,
  vendorController.deleteVendor.bind(vendorController)
);

module.exports = router;
