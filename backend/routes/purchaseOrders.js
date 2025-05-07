const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const purchaseOrders = await db.purchaseOrder.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(purchaseOrders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Create new purchase order
router.post('/', async (req, res) => {
  try {
    const { vendor_id, supplier_id, notes, status } = req.body;
    
    const po = await db.purchaseOrder.create({
      data: {
        vendor_id: vendor_id ? parseInt(vendor_id) : null,
        supplier_id: supplier_id ? parseInt(supplier_id) : null,
        notes,
        status: status || 'pending',
        po_number: await generatePONumber()
      }
    });
    
    res.status(201).json(po);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Get purchase order by ID
router.get('/:id', async (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    
    const po = await db.purchaseOrder.findUnique({
      where: { po_id: poId },
      include: {
        items: true
      }
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    // Add vendor/supplier information if applicable
    if (po.vendor_id) {
      const vendor = await db.vendor.findUnique({
        where: { vendor_id: po.vendor_id }
      });
      if (vendor) {
        po.vendor_name = vendor.name;
        po.vendor_address = vendor.address;
        po.vendor_email = vendor.email;
        po.vendor_phone = vendor.phone;
      }
    }
    
    if (po.supplier_id) {
      const supplier = await db.supplier.findUnique({
        where: { supplier_id: po.supplier_id }
      });
      if (supplier) {
        po.supplier_name = supplier.name;
        po.supplier_address = supplier.address;
        po.supplier_email = supplier.email;
        po.supplier_phone = supplier.phone;
      }
    }
    
    res.json(po);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Update purchase order
router.put('/:id', async (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const { vendor_id, supplier_id, notes, status } = req.body;
    
    const po = await db.purchaseOrder.update({
      where: { po_id: poId },
      data: {
        vendor_id: vendor_id ? parseInt(vendor_id) : null,
        supplier_id: supplier_id ? parseInt(supplier_id) : null,
        notes,
        status,
        updated_at: new Date()
      }
    });
    
    res.json(po);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// Add part to purchase order
router.post('/:id/items', async (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const { part_id, quantity, unit_price, custom_part, part_name, part_number } = req.body;
    
    // Validate purchase order exists
    const po = await db.purchaseOrder.findUnique({
      where: { po_id: poId }
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    let newItem;
    
    if (custom_part) {
      // Handle custom/miscellaneous item
      newItem = await db.purchaseOrderItem.create({
        data: {
          po_id: poId,
          custom_part: true,
          custom_part_name: part_name,
          custom_part_number: part_number,
          quantity: parseInt(quantity),
          unit_price: parseFloat(unit_price),
          total_price: parseFloat(quantity) * parseFloat(unit_price)
        }
      });
    } else {
      // Handle regular part from database
      // Validate part exists
      const part = await db.part.findUnique({
        where: { part_id: parseInt(part_id) }
      });
      
      if (!part) {
        return res.status(404).json({ error: 'Part not found' });
      }
      
      newItem = await db.purchaseOrderItem.create({
        data: {
          po_id: poId,
          part_id: parseInt(part_id),
          part_name: part.name,
          manufacturer_part_number: part.manufacturer_part_number,
          fiserv_part_number: part.fiserv_part_number,
          quantity: parseInt(quantity),
          unit_price: parseFloat(unit_price),
          total_price: parseFloat(quantity) * parseFloat(unit_price)
        }
      });
    }
    
    // Update PO total amount
    await updatePOTotalAmount(poId);
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding part to PO:', error);
    res.status(500).json({ error: 'Failed to add part to purchase order' });
  }
});

// Delete part from purchase order
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const poId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    
    // Validate purchase order exists
    const po = await db.purchaseOrder.findUnique({
      where: { po_id: poId }
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    // Validate item exists and belongs to this PO
    const item = await db.purchaseOrderItem.findFirst({
      where: {
        item_id: itemId,
        po_id: poId
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found in this purchase order' });
    }
    
    // Delete the item
    await db.purchaseOrderItem.delete({
      where: { item_id: itemId }
    });
    
    // Update PO total amount
    await updatePOTotalAmount(poId);
    
    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    console.error('Error removing item from PO:', error);
    res.status(500).json({ error: 'Failed to remove item from purchase order' });
  }
});

// Helper function to generate a unique PO number
async function generatePONumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Get the latest PO number with this prefix
  const prefix = `PO-${year}${month}-`;
  
  const latestPO = await db.purchaseOrder.findFirst({
    where: {
      po_number: {
        startsWith: prefix
      }
    },
    orderBy: {
      po_number: 'desc'
    }
  });
  
  let sequenceNumber = 1;
  
  if (latestPO && latestPO.po_number) {
    const latestSequence = parseInt(latestPO.po_number.split('-')[2]);
    if (!isNaN(latestSequence)) {
      sequenceNumber = latestSequence + 1;
    }
  }
  
  return `${prefix}${sequenceNumber.toString().padStart(4, '0')}`;
}

// Helper function to update the total amount of a purchase order
async function updatePOTotalAmount(poId) {
  try {
    // Get all items for this PO
    const items = await db.purchaseOrderItem.findMany({
      where: { po_id: poId }
    });
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    
    // Update the PO
    await db.purchaseOrder.update({
      where: { po_id: poId },
      data: {
        total_amount: total,
        updated_at: new Date()
      }
    });
    
    return total;
  } catch (error) {
    console.error('Error updating PO total amount:', error);
    throw error;
  }
}

module.exports = router; 