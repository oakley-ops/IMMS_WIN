# Troubleshooting Manual Purchase Order Form

## Overview

This document outlines the issues encountered while implementing the Manual Purchase Order form functionality and the solutions applied. These fixes addressed backend crashes, database schema mismatches, and frontend data handling issues.

## Issue 1: WebSocket Connection Errors

**Problem:** The application showed WebSocket errors in the console:
```
WebSocket connection to 'ws://localhost:4000/socket.io/?EIO=4&transport=websocket' failed
Socket connection error: TransportError: websocket error
```

**Root Cause:** Backend server was crashing due to a module import error. The controller was trying to import a module from an incorrect path.

**Solution:**
- Fixed the path in the import statement to correctly reference the pool module:
```javascript
// Incorrect
const pool = require('../db');

// Fixed
const { pool } = require('../../db');
```
- The db module needed to be imported with destructuring since it exports an object with multiple properties.

## Issue 2: "Cannot read properties of undefined (reading 'pool')" Error

**Problem:** After fixing the import, we encountered another error where the `this.pool` reference was undefined in the controller method.

**Root Cause:** The `this` context was being lost when the route handler called the controller method.

**Solution:**
1. Added method binding in the constructor to preserve the `this` context:
```javascript
constructor() {
  this.pool = pool;
  
  // Bind methods to instance to prevent 'this' context loss
  this.createBlankPurchaseOrder = this.createBlankPurchaseOrder.bind(this);
}
```

2. Updated the route declaration to also use bind():
```javascript
router.post('/blank', 
  authenticate, 
  [...validation rules...], 
  purchaseOrderController.createBlankPurchaseOrder.bind(purchaseOrderController)
);
```

## Issue 3: Database Schema Mismatch - Missing "shipping_cost" Column

**Problem:** Server error: `column "shipping_cost" of relation "purchase_orders" does not exist`

**Root Cause:** The controller was trying to insert values into columns that didn't exist in the database schema.

**Solution:**
- Updated the `createBlankPurchaseOrder` method to encode non-standard fields into the `notes` field as JSON instead of trying to use separate columns:
```javascript
// Format the notes to include special fields
const formattedNotes = JSON.stringify({
  original_notes: notes,
  is_urgent,
  next_day_air,
  shipping_cost,
  tax_amount,
  priority,
  requested_by,
  approved_by
});

// Insert PO with only columns that exist in the schema
const insertPoResult = await client.query(
  `INSERT INTO purchase_orders (
    po_number, supplier_id, status, notes
  ) VALUES ($1, $2, $3, $4) RETURNING po_id`,
  [poNumber, supplier_id, 'pending', formattedNotes]
);
```

## Issue 4: Invalid Sequence for PO Number Generation

**Problem:** Error when trying to generate PO numbers using `SELECT nextval('po_number_seq')`.

**Root Cause:** The sequence `po_number_seq` didn't exist in the database.

**Solution:**
- Replaced the sequence-based approach with a date-based PO number generation strategy:
```javascript
// Generate PO number using date-based approach
const currentDate = new Date();
const poPrefix = format(currentDate, 'yyyyMM');

// Get the latest PO number with this prefix
const poNumResult = await client.query(
  "SELECT po_number FROM purchase_orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1",
  [`${poPrefix}%`]
);

let nextNum = 1;
if (poNumResult.rows.length > 0) {
  // Extract the last number and increment with safer parsing
  // ...logic to parse and increment number...
}

const poNumber = `${poPrefix}-${nextNum.toString().padStart(4, '0')}`;
```

## Issue 5: Missing Custom Part Columns

**Problem:** Error: `column "custom_part_name" of relation "purchase_order_items" does not exist`

**Root Cause:** The database schema for purchase order items didn't include custom part fields that the code was trying to use.

**Solution:**
- Modified the `addItemToPurchaseOrder` method to store custom part information in the existing `notes` field as JSON:
```javascript
// Store custom part info in notes field since we don't have dedicated columns
const notes = JSON.stringify({
  custom_part: true,
  part_name: part_name || 'Custom part',
  part_number: part_number || 'N/A'
});

// Use available columns only
itemResult = await client.query(
  `INSERT INTO purchase_order_items 
   (po_id, part_id, quantity, unit_price, total_price, notes) 
   VALUES ($1, NULL, $2, $3, $4, $5) 
   RETURNING *`,
  [id, quantity, unit_price, total_price, notes]
);
```

## Issue 6: Email Destination Configuration

**Feature Enhancement:** Added the ability to manually specify email recipients rather than automatically using the supplier's email.

**Solution:**
1. Added a new field `recipientEmail` to the PurchaseOrder interface
2. Added a text field in the form UI for entering the email address
3. Updated the email sending logic to use the manually entered address:
```javascript
// Send the email with PDF using the manually entered email
await purchaseOrdersApi.sendPOEmail({
  recipient: purchaseOrder.recipientEmail,
  poNumber,
  poId,
  pdfBase64: base64data
});
```

## Best Practices and Lessons Learned

1. **Check Database Schema First:** Before writing code that interacts with a database, verify that columns you're trying to use actually exist.

2. **Handle Context Correctly:** When using controllers with Express, always bind methods or use arrow functions to preserve `this` context.

3. **Use Error Handling and Validation:** Implement proper error handling and validation to catch issues early and provide meaningful feedback.

4. **Fall Back Gracefully:** When a feature relies on something that may not exist (like a database sequence), have a fallback mechanism.

5. **Store Additional Data in JSON:** When dealing with schema limitations, consider using JSON in text fields to store additional properties without changing the schema.

6. **User-Provided Values Over Automatic:** Let users specify important information (like email recipients) rather than making assumptions.

7. **Test Incrementally:** Test major pieces of functionality individually before combining them to isolate and fix issues more easily. 