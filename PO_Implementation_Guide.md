# Purchase Order Manual Creation Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing manual Purchase Order (PO) creation with PDF generation and email capabilities. The implementation will allow users to:
- Create blank POs
- Add parts information manually (not saved to database)
- Select suppliers
- Generate PDFs using the existing template
- Email the PDF to suppliers

## Implementation Plan

### Mockup Testing Approach (First Step)
Before implementing the full functionality, we've created a mockup component to test the PDF generation functionality:

1. `src/components/PurchaseOrder/POFormMockup.jsx` - A self-contained component that:
   - Allows creating POs with manually entered data
   - Tests the PDF generation using the existing template
   - Simulates email functionality without making actual API calls
   - Doesn't save data to the database

2. `src/pages/TestPOPage.jsx` - A simple test page that renders the mockup component

To test the mockup approach:
1. Add the test page to your routes file temporarily:
   ```jsx
   import TestPOPage from '../pages/TestPOPage';
   
   // Add this to your routes
   <Route path="/test-po" element={<TestPOPage />} />
   ```
2. Navigate to `/test-po` in your browser
3. Fill out the form and test the PDF generation
4. Verify the generated PDF displays correctly and contains all required information

Once the mockup is validated, proceed with the full implementation steps below.

### 1. Create the PO Form Component

Create a new React component for manual PO creation:

```jsx
// src/components/PurchaseOrder/ManualPOForm.jsx
import React, { useState } from 'react';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';

const ManualPOForm = () => {
  // Component implementation here
};

export default ManualPOForm;
```

### 2. Define State Structure

```jsx
const [purchaseOrder, setPurchaseOrder] = useState({
  poNumber: '',
  requestedBy: '',
  approvedBy: '',
  createdAt: new Date().toISOString(),
  urgent: false,
  nextDayShipping: false,
  supplier: {
    name: '',
    contactName: '',
    address: '',
    email: '',
    phone: ''
  },
  items: [],
  shipping_cost: 0,
  tax_amount: 0
});

// For temporary item being added
const [currentItem, setCurrentItem] = useState({
  name: '',
  partNumber: '',
  quantity: 1,
  price: 0
});
```

### 3. Create Form UI

Create a multi-section form:
- PO Information section
- Supplier Information section 
- Items section with add/remove functionality
- Totals calculation section
- Action buttons (Preview PDF, Email PDF)

### 4. Implement Item Management Functions

```jsx
// Add item to PO
const addItem = () => {
  if (!currentItem.name || !currentItem.partNumber) return;
  
  setPurchaseOrder({
    ...purchaseOrder,
    items: [...purchaseOrder.items, {...currentItem}]
  });
  
  // Reset current item form
  setCurrentItem({
    name: '',
    partNumber: '',
    quantity: 1,
    price: 0
  });
};

// Remove item from PO
const removeItem = (index) => {
  const updatedItems = [...purchaseOrder.items];
  updatedItems.splice(index, 1);
  setPurchaseOrder({...purchaseOrder, items: updatedItems});
};
```

### 5. Implement PDF Preview Function

```jsx
const previewPO = async () => {
  try {
    await generatePurchaseOrderPDF(purchaseOrder);
  } catch (error) {
    console.error("Error generating PDF preview:", error);
    // Show error notification
  }
};
```

### 6. Implement Email Function

```jsx
const emailPO = async () => {
  try {
    // Get PDF as blob
    const pdfBlob = await generatePurchaseOrderPDF(purchaseOrder, true);
    
    // Create email data
    const emailData = {
      to: purchaseOrder.supplier.email,
      subject: `Purchase Order #${purchaseOrder.poNumber}`,
      text: `Please find attached Purchase Order #${purchaseOrder.poNumber}`,
      attachments: [{
        filename: `PO-${purchaseOrder.poNumber}.pdf`,
        content: pdfBlob,
        contentType: 'application/pdf'
      }]
    };
    
    // Call your email API endpoint
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to send email');
    }
    
    // Show success message
    alert('Purchase Order email sent successfully!');
    
  } catch (error) {
    console.error("Error sending PO email:", error);
    alert('Failed to send email. Please try again.');
  }
};
```

### 7. Create the API Endpoint for Email

Create an API endpoint to handle the email sending:

```js
// /api/email/send
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { to, subject, text, attachments } = req.body;
  
  try {
    // Configure your email transport (update with your SMTP details)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    
    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      attachments
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
}
```

### 8. Add the Component to Routes

Update your routing to include the new manual PO form:

```jsx
// In your routes file
import ManualPOForm from '../components/PurchaseOrder/ManualPOForm';

// Add this to your routes
<Route path="/purchase-orders/create-manual" element={<ManualPOForm />} />
```

### 9. Add Navigation Link

Add a link to the manual PO creation in your navigation menu or purchase order listing page:

```jsx
<Link to="/purchase-orders/create-manual" className="btn btn-primary">
  Create Manual PO
</Link>
```

## Testing Checklist

Before deploying to production, test:

1. ☐ Creating a blank PO form works
2. ☐ Adding/removing line items functions correctly
3. ☐ Supplier information can be entered
4. ☐ PDF preview generates correctly
5. ☐ Email functionality works (sends PDF attachment)
6. ☐ Validation prevents submission of incomplete forms

## Notes on Integration

- This implementation doesn't save POs to the database by design
- The PDF generation uses the existing template from `pdfTemplates.js`
- Ensure all form fields match the expected structure in the PDF template
- Email configuration requires environment variables for SMTP settings

## Troubleshooting

- If PDF doesn't generate correctly, check console for errors and ensure the purchaseOrder object structure matches what's expected in pdfTemplates.js
- For email issues, verify SMTP settings and check server logs
- Ensure proper CORS settings if your API is on a different domain than your frontend 

## Implementation Steps Summary

1. Start with the mockup approach to test PDF generation in isolation
2. Verify the data structure works with the existing PDF template
3. Implement the full ManualPOForm component once mockup is validated
4. Add API endpoint for email functionality
5. Integrate with routing and navigation
6. Test thoroughly before deploying to production 