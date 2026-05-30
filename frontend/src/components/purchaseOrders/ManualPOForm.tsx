import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';
import { suppliersApi, purchaseOrdersApi } from '../../services/api';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name: string;
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
  supplier: { supplier_id: number };
  items: LineItem[];
  shipping_cost: number;
  tax_amount: number;
  notes: string;
  recipientEmail: string;
}

const ManualPOForm: React.FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' | '' }>({
    text: '',
    type: ''
  });

  // State for searching suppliers
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [isManualSupplier, setIsManualSupplier] = useState(false);
  const [manualSupplierName, setManualSupplierName] = useState('');

  // State for the purchase order
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>({
    poNumber: 'Auto-generated',
    requestedBy: '',
    approvedBy: '',
    createdAt: new Date().toISOString(),
    urgent: false,
    nextDayShipping: false,
    supplier: { supplier_id: 0 },
    items: [],
    shipping_cost: 0,
    tax_amount: 0,
    notes: '',
    recipientEmail: ''
  });

  // For temporary item being added
  const [currentItem, setCurrentItem] = useState<LineItem>({
    name: '',
    partNumber: '',
    quantity: 1,
    price: 0
  });

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        const response = await suppliersApi.getAll();
        setSuppliers(response.data);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        setMessage({
          text: 'Failed to load suppliers. Please try refreshing the page.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setPurchaseOrder({ ...purchaseOrder, [name]: checked });
      return;
    }

    if (name.startsWith('supplier.')) {
      const field = name.split('.')[1];
      setPurchaseOrder({ ...purchaseOrder, supplier: { ...purchaseOrder.supplier, [field]: value } });
      return;
    }

    if (name === 'shipping_cost' || name === 'tax_amount') {
      setPurchaseOrder({ ...purchaseOrder, [name]: parseFloat(value) || 0 });
      return;
    }

    setPurchaseOrder({ ...purchaseOrder, [name]: value });
  };

  // Handle supplier selection
  const handleSupplierChange = (supplier: Supplier) => {
    setPurchaseOrder({ ...purchaseOrder, supplier: { supplier_id: supplier.supplier_id } });
    if (supplier.email) {
      setPurchaseOrder(prev => ({ ...prev, recipientEmail: supplier.email }));
    }
    setSupplierSearchTerm('');
    setSupplierResults([]);
  };

  // Handle item form field changes
  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setCurrentItem({ ...currentItem, [name]: parseFloat(value) || 0 });
      return;
    }
    setCurrentItem({ ...currentItem, [name]: value });
  };

  // Search suppliers
  const searchSuppliers = (term: string) => {
    if (!term.trim()) {
      setSupplierResults([]);
      return;
    }
    setSearchingSuppliers(true);
    const searchTerm = term.toLowerCase();
    const filteredSuppliers = suppliers.filter(supplier =>
      (supplier.name && supplier.name.toLowerCase().includes(searchTerm)) ||
      (supplier.contact_name && supplier.contact_name.toLowerCase().includes(searchTerm)) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm))
    );
    setSupplierResults(filteredSuppliers);
    setSearchingSuppliers(false);
  };

  const handleSupplierSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSupplierSearchTerm(term);
    searchSuppliers(term);
  };

  // Add item to PO
  const addItem = () => {
    if (!currentItem.name) {
      setMessage({ text: 'Please enter an item name.', type: 'warning' });
      return;
    }
    if (!currentItem.partNumber) {
      setMessage({ text: 'Please enter a part number.', type: 'warning' });
      return;
    }
    if (!currentItem.quantity || currentItem.quantity <= 0) {
      setMessage({ text: 'Please enter a valid quantity.', type: 'warning' });
      return;
    }
    setPurchaseOrder({ ...purchaseOrder, items: [...purchaseOrder.items, { ...currentItem }] });
    setCurrentItem({ name: '', partNumber: '', quantity: 1, price: 0 });
    setMessage({ text: 'Item added successfully.', type: 'success' });
  };

  // Remove item from PO
  const removeItem = (index: number) => {
    const updatedItems = [...purchaseOrder.items];
    updatedItems.splice(index, 1);
    setPurchaseOrder({ ...purchaseOrder, items: updatedItems });
  };

  // Calculate totals
  const calculateSubtotal = () =>
    purchaseOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const shippingCost = parseFloat(purchaseOrder.shipping_cost.toString()) || 0;
    const taxAmount = parseFloat(purchaseOrder.tax_amount.toString()) || 0;
    return subtotal + shippingCost + taxAmount;
  };

  // Preview PO as PDF
  const previewPO = async () => {
    if (!purchaseOrder.supplier.supplier_id && !isManualSupplier) {
      setMessage({ text: 'Please select a supplier or enable manual entry.', type: 'warning' });
      return;
    }
    if (isManualSupplier && !manualSupplierName.trim()) {
      setMessage({ text: 'Please enter a supplier name.', type: 'warning' });
      return;
    }
    if (purchaseOrder.items.length === 0) {
      setMessage({ text: 'At least one item is required.', type: 'warning' });
      return;
    }
    try {
      const selectedSupplier = suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);
      if (!selectedSupplier && !isManualSupplier) {
        setMessage({ text: 'Invalid supplier selected. Please select a valid supplier.', type: 'error' });
        return;
      }
      const pdfBlob = await generatePurchaseOrderPDF({
        ...purchaseOrder,
        supplier: selectedSupplier || { name: manualSupplierName }
      }, true);
      if (pdfBlob && pdfBlob instanceof Blob) {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      setMessage({ text: 'Failed to generate PDF preview.', type: 'error' });
    }
  };

  // Send PO via email
  const sendPOEmail = async (poId: number, poNumber: string) => {
    if (!purchaseOrder.recipientEmail) {
      setMessage({ text: 'Please enter a recipient email address.', type: 'warning' });
      return false;
    }
    try {
      const selectedSupplier = suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);
      const pdfBlob = await generatePurchaseOrderPDF({
        ...purchaseOrder,
        poNumber,
        supplier: selectedSupplier || { name: manualSupplierName }
      }, true);
      if (!pdfBlob || !(pdfBlob instanceof Blob)) {
        throw new Error('Failed to generate PDF');
      }
      const reader = new FileReader();
      return new Promise<boolean>((resolve) => {
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          try {
            await purchaseOrdersApi.sendPOEmail({
              recipient: purchaseOrder.recipientEmail,
              poNumber,
              poId,
              pdfBase64: base64data || ''
            });
            setMessage({ text: 'Purchase order email sent successfully!', type: 'success' });
            resolve(true);
          } catch (error) {
            console.error('Error sending email:', error);
            setMessage({ text: 'Failed to send email. Please try again.', type: 'error' });
            resolve(false);
          }
        };
        reader.readAsDataURL(pdfBlob);
      });
    } catch (error) {
      console.error('Error generating PDF for email:', error);
      setMessage({ text: 'Failed to generate PDF for email.', type: 'error' });
      return false;
    }
  };

  // Save PO
  const savePO = async () => {
    try {
      if (!purchaseOrder.supplier.supplier_id && !isManualSupplier) {
        setMessage({ text: 'Please select a supplier from the list or enable manual entry.', type: 'warning' });
        return;
      }
      if (isManualSupplier && !manualSupplierName.trim()) {
        setMessage({ text: 'Please enter a supplier name.', type: 'warning' });
        return;
      }
      if (purchaseOrder.items.length === 0) {
        setMessage({ text: 'At least one item is required.', type: 'warning' });
        return;
      }

      setSubmitting(true);

      let supplier_id: number | null = null;
      if (!isManualSupplier) {
        supplier_id = parseInt(String(purchaseOrder.supplier.supplier_id));
        if (isNaN(supplier_id) || supplier_id <= 0) {
          setMessage({ text: 'Invalid supplier selected. Please select a valid supplier.', type: 'error' });
          return;
        }
      }

      const poData: any = {
        supplier_id: supplier_id || undefined,
        notes: purchaseOrder.notes || '',
        is_urgent: purchaseOrder.urgent || false,
        next_day_air: purchaseOrder.nextDayShipping || false,
        shipping_cost: parseFloat(purchaseOrder.shipping_cost?.toString() || '0') || 0,
        tax_amount: parseFloat(purchaseOrder.tax_amount?.toString() || '0') || 0,
        requested_by: purchaseOrder.requestedBy || '',
        approved_by: purchaseOrder.approvedBy || '',
        items: []
      };

      if (isManualSupplier && manualSupplierName.trim()) {
        poData.manual_supplier_name = manualSupplierName.trim();
      }

      try {
        const blankPoResponse = await purchaseOrdersApi.createBlankPO(poData);
        const poId = blankPoResponse.data.po_id;
        const poNumber = blankPoResponse.data.po_number;

        for (const item of purchaseOrder.items) {
          const itemData = {
            part_id: null,
            custom_part: true,
            part_name: item.name,
            part_number: item.partNumber,
            quantity: item.quantity,
            unit_price: item.price
          };
          await purchaseOrdersApi.addItemToPO(poId, itemData);
        }

        setMessage({ text: 'Purchase order created successfully!', type: 'success' });

        if (purchaseOrder.recipientEmail) {
          setPurchaseOrder({ ...purchaseOrder, poNumber });
          if (window.confirm(`Would you like to email this PO to ${purchaseOrder.recipientEmail}?`)) {
            await sendPOEmail(poId, poNumber);
          }
        }

        setTimeout(() => {
          navigate(`/purchase-orders/detail/${poId}`);
        }, 2000);
      } catch (error: any) {
        console.error('Error creating PO:', error);
        let errorMessage = 'Failed to create purchase order.';
        if (error.response?.data?.errors) {
          errorMessage = error.response.data.errors.map((e: any) => e.msg).join(', ');
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        setMessage({ text: errorMessage, type: 'error' });
      } finally {
        setSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error in save process:', error);
      setMessage({ text: 'An unexpected error occurred.', type: 'error' });
      setSubmitting(false);
    }
  };

  const getSelectedSupplier = () =>
    suppliers.find(s => s.supplier_id === purchaseOrder.supplier.supplier_id);

  const isSubmitDisabled =
    submitting ||
    purchaseOrder.items.length === 0 ||
    (!purchaseOrder.supplier.supplier_id && !isManualSupplier) ||
    (isManualSupplier && !manualSupplierName.trim());

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', my: 3 }}>
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Create Manual Purchase Order
          </Typography>
          <IconButton onClick={() => navigate('/purchase-orders')}>
            ✕
          </IconButton>
        </Box>

        {/* Content */}
        <Box component="form" onSubmit={(e) => { e.preventDefault(); savePO(); }} sx={{ p: 3 }}>
          {message.text && (
            <Alert
              severity={message.type === '' ? 'info' : message.type as any}
              sx={{ mb: 3 }}
              onClose={() => setMessage({ text: '', type: '' })}
            >
              {message.text}
            </Alert>
          )}

          {/* PO Information */}
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            PO Information
          </Typography>

          {/* Supplier Selection */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">Supplier</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={isManualSupplier}
                    onChange={(e) => {
                      setIsManualSupplier(e.target.checked);
                      if (e.target.checked) {
                        setPurchaseOrder({ ...purchaseOrder, supplier: { supplier_id: 0 } });
                        setSupplierSearchTerm('');
                        setSupplierResults([]);
                      } else {
                        setManualSupplierName('');
                      }
                    }}
                    size="small"
                  />
                }
                label="Manual Entry"
                sx={{ m: 0 }}
              />
            </Box>

            {isManualSupplier ? (
              <TextField
                fullWidth
                size="small"
                value={manualSupplierName}
                onChange={(e) => setManualSupplierName(e.target.value)}
                placeholder="Enter supplier name manually"
              />
            ) : (
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  size="small"
                  value={supplierSearchTerm}
                  onChange={handleSupplierSearchChange}
                  placeholder="Search for a supplier"
                  disabled={!!getSelectedSupplier()}
                  InputProps={{
                    endAdornment: searchingSuppliers ? <CircularProgress size={16} /> : undefined
                  }}
                />
              </Box>
            )}

            {!isManualSupplier && supplierResults.length > 0 && !getSelectedSupplier() && (
              <Paper elevation={3} sx={{ mt: 0.5, maxHeight: 200, overflow: 'auto', zIndex: 100, position: 'relative' }}>
                {supplierResults.map((supplier) => (
                  <Box
                    key={`supplier-${supplier.supplier_id}`}
                    onClick={() => handleSupplierChange(supplier)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      '&:hover': { bgcolor: 'rgba(255,102,0,0.05)' }
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold">{supplier.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Contact: {supplier.contact_name} | Email: {supplier.email || 'N/A'}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            {!isManualSupplier && getSelectedSupplier() && (
              <Card variant="outlined" sx={{ mt: 1 }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{getSelectedSupplier()?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Contact: {getSelectedSupplier()?.contact_name}<br />
                        Email: {getSelectedSupplier()?.email || 'N/A'}<br />
                        Phone: {getSelectedSupplier()?.phone || 'N/A'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setPurchaseOrder({ ...purchaseOrder, supplier: { supplier_id: 0 }, recipientEmail: '' });
                      }}
                    >
                      Change Supplier
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* PO Details */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Requested By"
                name="requestedBy"
                value={purchaseOrder.requestedBy}
                onChange={handleChange}
                placeholder="Enter name"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Approved By"
                name="approvedBy"
                value={purchaseOrder.approvedBy}
                onChange={handleChange}
                placeholder="Enter name"
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={purchaseOrder.urgent}
                  onChange={(e) => setPurchaseOrder({ ...purchaseOrder, urgent: e.target.checked })}
                  size="small"
                />
              }
              label="Mark as Urgent"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={purchaseOrder.nextDayShipping}
                  onChange={(e) => setPurchaseOrder({ ...purchaseOrder, nextDayShipping: e.target.checked })}
                  size="small"
                />
              }
              label="Next Day Air"
            />
          </Box>

          <TextField
            fullWidth
            size="small"
            type="email"
            label="Recipient Email (optional for sending PO)"
            name="recipientEmail"
            value={purchaseOrder.recipientEmail}
            onChange={handleChange}
            placeholder="Enter email address"
            sx={{ mb: 3 }}
          />

          {/* Line Items Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">Line Items</Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={addItem}
                disabled={!currentItem.name || !currentItem.partNumber || currentItem.quantity <= 0}
                size="small"
              >
                Add Item
              </Button>
            </Box>

            {purchaseOrder.items.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell>Name</TableCell>
                      <TableCell>Part Number</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseOrder.items.map((item, index) => (
                      <TableRow key={`item-${index}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.partNumber}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.price.toFixed(2)}</TableCell>
                        <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Add new item form */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                  Add New Item
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Item Name"
                      name="name"
                      value={currentItem.name}
                      onChange={handleItemChange}
                      placeholder="Enter item name"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Part Number"
                      name="partNumber"
                      value={currentItem.partNumber}
                      onChange={handleItemChange}
                      placeholder="Enter part number"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Quantity"
                      type="number"
                      name="quantity"
                      value={currentItem.quantity}
                      onChange={handleItemChange}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Unit Price"
                      type="number"
                      name="price"
                      value={currentItem.price}
                      onChange={handleItemChange}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>

          {/* Order Totals & Notes */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Notes</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                name="notes"
                value={purchaseOrder.notes}
                onChange={handleChange}
                placeholder="Enter any additional notes or special instructions"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Order Totals</Typography>
              <Card variant="outlined">
                <CardContent>
                  <TextField
                    fullWidth
                    size="small"
                    label="Shipping Cost"
                    type="number"
                    name="shipping_cost"
                    value={purchaseOrder.shipping_cost}
                    onChange={handleChange}
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Tax Amount"
                    type="number"
                    name="tax_amount"
                    value={purchaseOrder.tax_amount}
                    onChange={handleChange}
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Subtotal:</Typography>
                    <Typography variant="body2">${calculateSubtotal().toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Shipping:</Typography>
                    <Typography variant="body2">${parseFloat(purchaseOrder.shipping_cost.toString()).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Tax:</Typography>
                    <Typography variant="body2">${parseFloat(purchaseOrder.tax_amount.toString()).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid #eee', pt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" fontWeight="bold">Total:</Typography>
                    <Typography variant="body1" fontWeight="bold">${calculateTotal().toFixed(2)}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Footer Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2, borderTop: '1px solid #eee' }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/purchase-orders')}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
              onClick={previewPO}
              disabled={isSubmitDisabled}
            >
              Preview PDF
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              disabled={isSubmitDisabled}
            >
              {submitting ? 'Saving...' : 'Save PO'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ManualPOForm;
