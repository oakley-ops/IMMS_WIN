import React, { useState } from 'react';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import { PRIMARY_ORANGE } from '../../theme';

interface Supplier {
  name: string;
  contactName: string;
  address: string;
  email: string;
  phone: string;
}

interface LineItem {
  name: string;
  partNumber: string;
  quantity: number;
  price: number;
}

interface PurchaseOrder {
  poNumber: string;
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
  urgent: boolean;
  nextDayShipping: boolean;
  supplier: Supplier;
  items: LineItem[];
  shipping_cost: number;
  tax_amount: number;
}

const POFormMockup: React.FC = () => {
  // State for the purchase order
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>({
    poNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
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
  const [currentItem, setCurrentItem] = useState<LineItem>({
    name: '',
    partNumber: '',
    quantity: 1,
    price: 0
  });

  // Load sample data function
  const loadSampleData = () => {
    const samplePurchaseOrder = {
      poNumber: 'PO-2023-' + Math.floor(1000 + Math.random() * 9000),
      requestedBy: 'John Doe',
      approvedBy: 'Jane Smith',
      createdAt: new Date().toISOString(),
      urgent: true,
      nextDayShipping: true,
      supplier: {
        name: 'ABC Electronics Supply',
        contactName: 'Robert Johnson',
        address: '123 Main Street, Suite 100, Anytown, CA 12345',
        email: 'sales@abcelectronics.example.com',
        phone: '(555) 123-4567'
      },
      items: [
        {
          name: 'Processor Board',
          partNumber: 'FV-CPU-2022',
          quantity: 5,
          price: 249.99
        },
        {
          name: 'Memory Module 16GB',
          partNumber: 'FV-RAM-16G',
          quantity: 10,
          price: 89.95
        },
        {
          name: 'Power Supply 750W',
          partNumber: 'FV-PSU-750',
          quantity: 3,
          price: 119.50
        }
      ],
      shipping_cost: 45.00,
      tax_amount: 123.75
    };

    setPurchaseOrder(samplePurchaseOrder);
  };

  // Handle form changes for basic fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      // Handle nested properties (e.g., supplier.name)
      const [parent, child] = name.split('.');
      setPurchaseOrder({
        ...purchaseOrder,
        [parent]: {
          ...purchaseOrder[parent as keyof PurchaseOrder] as Record<string, any>,
          [child]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      // Handle top-level properties
      setPurchaseOrder({
        ...purchaseOrder,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  // Handle changes to the current item form
  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = ['quantity', 'price'].includes(name)
      ? parseFloat(value) || 0
      : value;

    setCurrentItem({
      ...currentItem,
      [name]: numericValue
    } as LineItem);
  };

  // Add item to PO
  const addItem = () => {
    if (!currentItem.name || !currentItem.partNumber) {
      alert('Part name and part number are required.');
      return;
    }

    setPurchaseOrder({
      ...purchaseOrder,
      items: [...purchaseOrder.items, { ...currentItem }]
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
  const removeItem = (index: number) => {
    const updatedItems = [...purchaseOrder.items];
    updatedItems.splice(index, 1);
    setPurchaseOrder({ ...purchaseOrder, items: updatedItems });
  };

  // Calculate totals
  const calculateSubtotal = () => {
    return purchaseOrder.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const shippingCost = parseFloat(purchaseOrder.shipping_cost.toString()) || 0;
    const taxAmount = parseFloat(purchaseOrder.tax_amount.toString()) || 0;
    return subtotal + shippingCost + taxAmount;
  };

  // Preview PDF function
  const previewPO = async () => {
    try {
      if (!purchaseOrder.poNumber || !purchaseOrder.supplier.name) {
        alert('PO Number and Supplier Name are required.');
        return;
      }

      if (purchaseOrder.items.length === 0) {
        alert('At least one item is required.');
        return;
      }

      console.log('Generating PDF for:', purchaseOrder);
      await generatePurchaseOrderPDF(purchaseOrder);
    } catch (error: any) {
      console.error("Error generating PDF preview:", error);
      alert(`Error generating PDF: ${error.message}`);
    }
  };

  // Mock email function
  const mockEmailPO = () => {
    if (!purchaseOrder.poNumber || !purchaseOrder.supplier.name || !purchaseOrder.supplier.email) {
      alert('PO Number, Supplier Name, and Supplier Email are required for email.');
      return;
    }

    if (purchaseOrder.items.length === 0) {
      alert('At least one item is required.');
      return;
    }

    alert(`In a real implementation, an email would be sent to ${purchaseOrder.supplier.email} with the PO #${purchaseOrder.poNumber} as a PDF attachment.`);
  };

  const sectionCard = (title: string, children: React.ReactNode) => (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: 3 }}>
      <Box sx={{ px: 3, py: 1.5, backgroundColor: PRIMARY_ORANGE, borderRadius: '8px 8px 0 0' }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <CardContent sx={{ pt: 2 }}>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Create Purchase Order (Mockup)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        This is a test form to verify PDF generation. Data is not saved to the database.
      </Typography>

      <Box display="flex" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={loadSampleData}>
          Load Sample Data
        </Button>
      </Box>

      {/* PO Information */}
      {sectionCard('PO Information', (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="PO Number"
              name="poNumber"
              value={purchaseOrder.poNumber}
              onChange={handleChange}
              required
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Requested By"
              name="requestedBy"
              value={purchaseOrder.requestedBy}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Approved By"
              name="approvedBy"
              value={purchaseOrder.approvedBy}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="urgent"
                  checked={purchaseOrder.urgent}
                  onChange={handleChange}
                />
              }
              label="Urgent Order"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="nextDayShipping"
                  checked={purchaseOrder.nextDayShipping}
                  onChange={handleChange}
                />
              }
              label="Next Day Shipping"
            />
          </Grid>
        </Grid>
      ))}

      {/* Supplier Information */}
      {sectionCard('Supplier Information', (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Supplier Name"
              name="supplier.name"
              value={purchaseOrder.supplier.name}
              onChange={handleChange}
              required
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Contact Person"
              name="supplier.contactName"
              value={purchaseOrder.supplier.contactName}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              name="supplier.address"
              value={purchaseOrder.supplier.address}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              name="supplier.email"
              value={purchaseOrder.supplier.email}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              name="supplier.phone"
              value={purchaseOrder.supplier.phone}
              onChange={handleChange}
              size="small"
            />
          </Grid>
        </Grid>
      ))}

      {/* Line Items */}
      {sectionCard('Line Items', (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Part Name</TableCell>
                  <TableCell>Part Number</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit Price</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseOrder.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.partNumber}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.price.toFixed(2)}</TableCell>
                    <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {purchaseOrder.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                      No items added
                    </TableCell>
                  </TableRow>
                )}
                {/* Add Item Row */}
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="Part Name"
                      name="name"
                      value={currentItem.name}
                      onChange={handleItemChange}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="Part #"
                      name="partNumber"
                      value={currentItem.partNumber}
                      onChange={handleItemChange}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="Qty"
                      name="quantity"
                      value={currentItem.quantity}
                      onChange={handleItemChange}
                      inputProps={{ min: 1 }}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="Price"
                      name="price"
                      value={currentItem.price}
                      onChange={handleItemChange}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>${(currentItem.price * currentItem.quantity).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      onClick={addItem}
                    >
                      Add Item
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ))}

      {/* Order Totals */}
      {sectionCard('Order Totals', (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body1">
              Items Subtotal: <strong>${calculateSubtotal().toFixed(2)}</strong>
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Shipping Cost"
              type="number"
              name="shipping_cost"
              value={purchaseOrder.shipping_cost}
              onChange={handleChange}
              inputProps={{ min: 0, step: 0.01 }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body1">
              Grand Total: <strong>${calculateTotal().toFixed(2)}</strong>
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tax Amount"
              type="number"
              name="tax_amount"
              value={purchaseOrder.tax_amount}
              onChange={handleChange}
              inputProps={{ min: 0, step: 0.01 }}
              size="small"
            />
          </Grid>
        </Grid>
      ))}

      <Box display="flex" justifyContent="flex-end" gap={1} sx={{ mb: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={previewPO}
        >
          Preview PDF
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={mockEmailPO}
        >
          Simulate Email PO
        </Button>
      </Box>

      <Alert severity="info">
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Mockup Testing Notes:
        </Typography>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>This is a mockup for testing PDF generation</li>
          <li>Data is not saved to any database</li>
          <li>Email functionality is simulated</li>
          <li>The PDF preview uses the actual PDF template from pdfTemplates.js</li>
          <li>Click "Load Sample Data" to quickly test with pre-filled information</li>
        </ul>
      </Alert>
    </Box>
  );
};

export default POFormMockup;
