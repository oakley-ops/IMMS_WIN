import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { PRIMARY_ORANGE } from '../../theme';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ManualPOEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  pdfFile: File | null;
}

const ManualPOEntryDialog: React.FC<ManualPOEntryDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  pdfFile 
}) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Supplier dropdown state
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Parts search state
  const [partSearchResults, setPartSearchResults] = useState<any[]>([]);
  const [searchingParts, setSearchingParts] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Form state
  const [vendorName, setVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');

  // Create PDF preview URL when file changes
  React.useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfFile]);

  // Fetch suppliers when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/v1/suppliers`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      
      // Extract supplier names from response
      const supplierNames = response.data.map((s: any) => s.name).sort();
      setSuppliers(supplierNames);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      // Don't show error, just allow manual entry
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    return subtotal + tax;
  };

  const handleAddItem = () => {
    const newId = (Math.max(...lineItems.map(i => parseInt(i.id))) + 1).toString();
    setLineItems([...lineItems, { id: newId, description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));

    // Search parts when description changes
    if (field === 'description' && value.length >= 2) {
      searchParts(value, id);
    } else if (field === 'description' && value.length < 2) {
      setPartSearchResults([]);
      setActiveItemId(null);
    }
  };

  const searchParts = async (query: string, itemId: string) => {
    try {
      setSearchingParts(true);
      setActiveItemId(itemId);
      
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/v1/parts/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      
      setPartSearchResults(response.data.slice(0, 5)); // Limit to 5 results
    } catch (err) {
      console.error('Error searching parts:', err);
      setPartSearchResults([]);
    } finally {
      setSearchingParts(false);
    }
  };

  const selectPart = (itemId: string, part: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          description: part.name,
          unitPrice: part.unit_cost || 0,
          total: item.quantity * (part.unit_cost || 0)
        };
      }
      return item;
    }));
    setPartSearchResults([]);
    setActiveItemId(null);
  };

  const handleCreatePart = (description: string) => {
    // Open Add Part dialog with pre-filled description
    window.alert(`Part creation feature: Would create part with name "${description}"\n\nThis will be integrated with your Add Part dialog.`);
    setPartSearchResults([]);
    setActiveItemId(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!vendorName.trim()) {
      setError('Vendor name is required');
      return;
    }

    if (lineItems.length === 0 || !lineItems.some(item => item.description.trim())) {
      setError('At least one line item is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Add PDF file
      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }

      // Add PO data
      formData.append('vendorName', vendorName);
      formData.append('poNumber', poNumber);
      formData.append('poDate', poDate);
      formData.append('tax', tax.toString());
      formData.append('notes', notes);
      formData.append('lineItems', JSON.stringify(lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }))));

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/v1/purchase-orders/import-manual`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      console.log('Manual PO created:', response.data);
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Navigate to the created PO
      navigate(`/purchase-orders/${response.data.po_id}`);
      onClose();
      
    } catch (err: any) {
      console.error('Manual import error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh', borderRadius: '0.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Create Purchase Order from PDF</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ padding: '2rem' }}>
        <Grid container spacing={4}>
          {/* PDF Preview */}
          {pdfUrl && (
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 2, height: '600px' }}>
                <Typography variant="subtitle2" gutterBottom>
                  PDF Preview
                </Typography>
                <iframe
                  src={pdfUrl}
                  style={{ width: '100%', height: 'calc(100% - 30px)', border: 'none' }}
                  title="PDF Preview"
                />
              </Paper>
            </Grid>
          )}

          {/* Entry Form */}
          <Grid item xs={12} md={pdfUrl ? 6 : 12}>
            <Box>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Basic Info */}
              <div style={{ marginBottom: '1.5rem' }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: PRIMARY_ORANGE, 
                    fontWeight: 600, 
                    mb: 2,
                    fontSize: '1.1rem'
                  }}
                >
                  Basic Information
                </Typography>
                <div style={{ 
                  border: `2px solid ${PRIMARY_ORANGE}`, 
                  borderRadius: '0.75rem', 
                  padding: '1.25rem' 
                }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Autocomplete
                      freeSolo
                      options={suppliers}
                      value={vendorName}
                      onChange={(event, newValue) => {
                        setVendorName(newValue || '');
                      }}
                      onInputChange={(event, newInputValue) => {
                        setVendorName(newInputValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Vendor Name *"
                          size="small"
                          helperText={loadingSuppliers ? 'Loading suppliers...' : 'Select existing or type new'}
                        />
                      )}
                      loading={loadingSuppliers}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="PO Number"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      size="small"
                      helperText="Leave blank to auto-generate"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="PO Date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ marginBottom: '2rem' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: PRIMARY_ORANGE, 
                      fontWeight: 600,
                      fontSize: '1.1rem'
                    }}
                  >
                    Line Items
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddItem}
                    variant="outlined"
                  >
                    Add Item
                  </Button>
                </Box>

                <div style={{ 
                  border: `2px solid ${PRIMARY_ORANGE}`, 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem' 
                }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell width="80px">Qty</TableCell>
                        <TableCell width="100px">Price</TableCell>
                        <TableCell width="100px">Total</TableCell>
                        <TableCell width="50px"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell sx={{ py: 1.5 }}>
                            <Box position="relative">
                              <TextField
                                fullWidth
                                size="small"
                                value={item.description}
                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                placeholder="Type to search parts..."
                              />
                              
                              {/* Part Search Results Dropdown */}
                              {activeItemId === item.id && partSearchResults.length > 0 && (
                                <Paper
                                  elevation={3}
                                  sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1000,
                                    maxHeight: '200px',
                                    overflow: 'auto',
                                    mt: 0.5
                                  }}
                                >
                                  <List dense>
                                    {partSearchResults.map((part) => (
                                      <ListItem
                                        key={part.part_id}
                                        button
                                        onClick={() => selectPart(item.id, part)}
                                        sx={{
                                          '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.1)' }
                                        }}
                                      >
                                        <ListItemText
                                          primary={part.name}
                                          secondary={`${part.manufacturer_part_number || 'No part #'} - $${part.unit_cost || 0}`}
                                        />
                                      </ListItem>
                                    ))}
                                  </List>
                                  <Box
                                    sx={{
                                      borderTop: '1px solid #ddd',
                                      p: 1,
                                      bgcolor: '#f5f5f5',
                                      cursor: 'pointer',
                                      '&:hover': { bgcolor: 'rgba(255, 102, 0, 0.1)' }
                                    }}
                                    onClick={() => handleCreatePart(item.description)}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ color: PRIMARY_ORANGE, fontWeight: 600 }}
                                    >
                                      + Create New Part "{item.description}"
                                    </Typography>
                                  </Box>
                                </Paper>
                              )}

                              {/* No Results */}
                              {activeItemId === item.id && item.description.length >= 2 && partSearchResults.length === 0 && !searchingParts && (
                                <Paper
                                  elevation={3}
                                  sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1000,
                                    mt: 0.5,
                                    p: 1.5
                                  }}
                                >
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    No matching parts found
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleCreatePart(item.description)}
                                    sx={{
                                      borderColor: PRIMARY_ORANGE,
                                      color: PRIMARY_ORANGE,
                                      '&:hover': {
                                        borderColor: PRIMARY_ORANGE,
                                        bgcolor: 'rgba(255, 102, 0, 0.1)'
                                      }
                                    }}
                                  >
                                    Create Part "{item.description}"
                                  </Button>
                                </Paper>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <TextField
                              type="number"
                              size="small"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <TextField
                              type="number"
                              size="small"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <Typography variant="body1" fontWeight={500}>
                              ${item.total.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={lineItems.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                </div>
              </div>

              {/* Totals & Notes */}
              <div style={{ marginBottom: '2rem' }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: PRIMARY_ORANGE, 
                    fontWeight: 600, 
                    mb: 2,
                    fontSize: '1.1rem'
                  }}
                >
                  Totals & Notes
                </Typography>
                <div style={{ 
                  border: `2px solid ${PRIMARY_ORANGE}`, 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem' 
                }}>
                <Grid container spacing={2.5}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Tax"
                      value={tax}
                      onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                      size="small"
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Box textAlign="right" pt={1}>
                      <Typography variant="body1" color="text.secondary" gutterBottom>
                        Subtotal: ${lineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                        Total: ${calculateTotal().toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      size="small"
                    />
                  </Grid>
                </Grid>
                </div>
              </div>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          variant="outlined"
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
          color="primary"
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {submitting ? 'Creating...' : 'Create Purchase Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualPOEntryDialog;
