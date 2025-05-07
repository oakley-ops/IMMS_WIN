const express = require('express');
const PurchaseOrderController = require('../controllers/PurchaseOrderController');
const authenticate = require('../middleware/authMiddleware');
const roleAuthorization = require('../middleware/roleMiddleware');
const { body } = require('express-validator');

const router = express.Router();
const purchaseOrderController = new PurchaseOrderController();

// Define role permissions
const ROLES = {
  ALL: ['admin', 'tech', 'purchasing'],
  ADMIN_PURCHASING: ['admin', 'purchasing'],
  ADMIN_ONLY: ['admin']
};

// GET all purchase orders - accessible by all authenticated users
router.get('/', 
  authenticate, 
  roleAuthorization(ROLES.ALL), 
  purchaseOrderController.getAllPurchaseOrders.bind(purchaseOrderController)
);

// GET parts with pending purchase orders - accessible by admin and purchasing
router.get(
  '/parts-with-pending-orders',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.getPartsWithPendingOrders.bind(purchaseOrderController)
);

// GET purchase order by ID - accessible by all authenticated users
router.get('/:id', 
  authenticate, 
  roleAuthorization(ROLES.ALL), 
  purchaseOrderController.getPurchaseOrderById.bind(purchaseOrderController)
);

// GET documents for a purchase order - accessible by all authenticated users
router.get('/:id/documents',
  authenticate,
  roleAuthorization(ROLES.ALL),
  purchaseOrderController.getDocumentsByPurchaseOrderId.bind(purchaseOrderController)
);

// GET download a specific document - accessible by all authenticated users
router.get('/documents/:documentId/download',
  authenticate,
  roleAuthorization(ROLES.ALL),
  purchaseOrderController.downloadDocument.bind(purchaseOrderController)
);

// DELETE a specific document - accessible by admin and purchasing
router.delete('/documents/:documentId',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.deleteDocument.bind(purchaseOrderController)
);

// POST upload document for a purchase order - accessible by admin and purchasing
router.post('/:id/documents',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.uploadDocument.bind(purchaseOrderController)
);

// POST create purchase order - accessible by admin and purchasing
router.post(
  '/',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.getValidationRules(),
  purchaseOrderController.createPurchaseOrder.bind(purchaseOrderController)
);

// PUT update purchase order status - accessible by admin and purchasing
router.put(
  '/:id/status',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.updatePurchaseOrderStatus.bind(purchaseOrderController)
);

// PUT update general purchase order fields - accessible by admin and purchasing
router.put(
  '/:id',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.updatePurchaseOrder.bind(purchaseOrderController)
);

// DELETE purchase order - admin only
router.delete(
  '/:id',
  authenticate,
  roleAuthorization(ROLES.ADMIN_ONLY),
  purchaseOrderController.deletePurchaseOrder.bind(purchaseOrderController)
);

// POST generate purchase orders for parts - admin and purchasing
router.post(
  '/generate-for-low-stock',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.generatePurchaseOrdersForParts.bind(purchaseOrderController)
);

// New routes for managing purchase order items
// POST add item to purchase order - admin and purchasing
router.post(
  '/:id/items',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.addItemToPurchaseOrder.bind(purchaseOrderController)
);

// DELETE remove item from purchase order - admin and purchasing
router.delete(
  '/:id/items/:itemId',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.removeItemFromPurchaseOrder.bind(purchaseOrderController)
);

// PUT update item in purchase order - admin and purchasing
router.put(
  '/:id/items/:itemId',
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  purchaseOrderController.updateItemInPurchaseOrder.bind(purchaseOrderController)
);

// POST create blank purchase order - admin and purchasing
router.post('/blank', 
  authenticate,
  roleAuthorization(ROLES.ADMIN_PURCHASING),
  [
    body('supplier_id').isInt().withMessage('Supplier ID must be an integer'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
    body('is_urgent').optional().isBoolean().withMessage('is_urgent must be a boolean'),
    body('next_day_air').optional().isBoolean().withMessage('next_day_air must be a boolean'),
    body('shipping_cost').optional().isFloat({ min: 0 }).withMessage('Shipping cost must be a positive number'),
    body('tax_amount').optional().isFloat({ min: 0 }).withMessage('Tax amount must be a positive number'),
    body('requested_by').optional().isString().withMessage('Requested by must be a string'),
    body('approved_by').optional().isString().withMessage('Approved by must be a string'),
    body('priority').optional().isString().withMessage('Priority must be a string')
  ], 
  purchaseOrderController.createBlankPurchaseOrder.bind(purchaseOrderController)
);

module.exports = router;