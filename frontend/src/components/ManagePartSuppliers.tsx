import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  SelectChangeEvent,
  Card,
  CardContent,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import axiosInstance from '../utils/axios';
import { PartSupplier } from '../store/partsSlice';

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface ManagePartSuppliersProps {
  partId: number;
  onUpdate?: () => void;
  isNewPart?: boolean;
}

const ManagePartSuppliers: React.FC<ManagePartSuppliersProps> = ({ partId, onUpdate, isNewPart = false }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partSuppliers, setPartSuppliers] = useState<PartSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add/Edit supplier dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<PartSupplier | null>(null);
  const [formData, setFormData] = useState<Partial<PartSupplier>>({
    supplier_id: 0,
    unit_cost: 0,
    is_preferred: false,
    lead_time_days: 0,
    minimum_order_quantity: 1
  });

  // Load part suppliers on mount
  useEffect(() => {
    fetchPartSuppliers();
    fetchAllSuppliers();
  }, [partId]);

  const fetchPartSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get(`/api/v1/parts/${partId}/suppliers`);
      setPartSuppliers(response.data);
    } catch (err) {
      console.error('Error fetching part suppliers:', err);
      setError('Failed to load suppliers for this part');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSuppliers = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('Error fetching all suppliers:', err);
      // Don't set error state here to avoid overriding part suppliers error message
    }
  };

  const handleOpenDialog = (supplier?: PartSupplier) => {
    if (supplier) {
      // Edit existing supplier
      setSelectedSupplier(supplier);
      setFormData({
        supplier_id: supplier.supplier_id,
        unit_cost: supplier.unit_cost,
        is_preferred: supplier.is_preferred,
        lead_time_days: supplier.lead_time_days || 0,
        minimum_order_quantity: supplier.minimum_order_quantity || 1
      });
    } else {
      // Add new supplier
      setSelectedSupplier(null);
      setFormData({
        supplier_id: 0,
        unit_cost: 0,
        is_preferred: false,
        lead_time_days: 0,
        minimum_order_quantity: 1
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedSupplier(null);
    setFormData({
      supplier_id: 0,
      unit_cost: 0,
      is_preferred: false,
      lead_time_days: 0,
      minimum_order_quantity: 1
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
    });
  };

  const handleSelectChange = (e: SelectChangeEvent<number>) => {
    setFormData({
      ...formData,
      supplier_id: e.target.value as number
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!formData.supplier_id) {
        throw new Error('Please select a supplier');
      }

      // Check if this supplier is already associated with this part
      const existingSupplier = partSuppliers.find(s => s.supplier_id === formData.supplier_id);
      if (existingSupplier && !selectedSupplier) {
        setError('This supplier is already associated with this part');
        setLoading(false);
        return;
      }

      if (selectedSupplier) {
        // Update existing supplier
        await axiosInstance.put(
          `/api/v1/parts/${partId}/suppliers/${selectedSupplier.supplier_id}`,
          {
            unit_cost: formData.unit_cost || 0,
            is_preferred: formData.is_preferred || false,
            lead_time_days: formData.lead_time_days || 0,
            minimum_order_quantity: formData.minimum_order_quantity || 1
          }
        );
        setSuccess('Supplier updated successfully');
      } else {
        // Add new supplier
        try {
          await axiosInstance.post(
            `/api/v1/parts/${partId}/suppliers`,
            {
              supplier_id: formData.supplier_id,
              unit_cost: formData.unit_cost || 0,
              is_preferred: formData.is_preferred || false,
              lead_time_days: formData.lead_time_days || 0,
              minimum_order_quantity: formData.minimum_order_quantity || 1
            }
          );
          setSuccess('Supplier added successfully');
        } catch (err: any) {
          // Check if the error is because the supplier is already associated
          if (err.response && err.response.status === 400 && 
              err.response.data && err.response.data.error === 'This supplier is already associated with this part') {
            setError('This supplier is already associated with this part');
            return;
          }
          // Re-throw for general error handling
          throw err;
        }
      }
      
      // Refresh data
      fetchPartSuppliers();
      if (onUpdate) onUpdate();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      setError(err.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (supplierId: number) => {
    // First check if this is the only supplier for the part
    if (partSuppliers.length <= 1) {
      setError('Cannot delete the last supplier. A part must have at least one supplier.');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this supplier?')) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await axiosInstance.delete(`/api/v1/parts/${partId}/suppliers/${supplierId}`);
      setSuccess('Supplier removed successfully');
      
      // Remove the supplier from the local state immediately
      setPartSuppliers(prevSuppliers => prevSuppliers.filter(s => s.supplier_id !== supplierId));
      
      // Refresh data from the server
      await fetchPartSuppliers();
      
      // Call the onUpdate callback to refresh the parent component if needed
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error removing supplier:', err);
      setError('Failed to remove supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPreferred = async (supplierId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      await axiosInstance.put(
        `/api/v1/parts/${partId}/suppliers/${supplierId}`,
        { is_preferred: true }
      );
      setSuccess('Preferred supplier updated');
      fetchPartSuppliers();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error setting preferred supplier:', err);
      setError('Failed to update preferred supplier');
    } finally {
      setLoading(false);
    }
  };

  // Get available suppliers (excluding those already added)
  const getAvailableSuppliers = () => {
    const existingSupplierIds = partSuppliers.map(ps => ps.supplier_id);
    return suppliers.filter(s => !existingSupplierIds.includes(s.supplier_id) || 
                                (selectedSupplier && s.supplier_id === selectedSupplier.supplier_id));
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  return (
    <Card variant="outlined" className="mb-4">
      <CardContent>
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}
        {success && <Alert severity="success" className="mb-3">{success}</Alert>}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Part Suppliers</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Supplier
          </Button>
        </Box>
        
        {loading && partSuppliers.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : partSuppliers.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Supplier</strong></TableCell>
                  <TableCell><strong>Unit Cost</strong></TableCell>
                  <TableCell><strong>Lead Time (days)</strong></TableCell>
                  <TableCell><strong>Min. Order Qty</strong></TableCell>
                  <TableCell><strong>Preferred</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partSuppliers.map((supplier) => (
                  <TableRow key={supplier.part_supplier_id || supplier.supplier_id}>
                    <TableCell>{getSupplierName(supplier.supplier_id)}</TableCell>
                    <TableCell>${(Number(supplier.unit_cost) || 0).toFixed(2)}</TableCell>
                    <TableCell>{supplier.lead_time_days || '-'}</TableCell>
                    <TableCell>{supplier.minimum_order_quantity || '1'}</TableCell>
                    <TableCell>
                      <Checkbox 
                        checked={supplier.is_preferred || false}
                        onChange={() => handleSetPreferred(supplier.supplier_id)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          onClick={() => handleOpenDialog(supplier)}
                          title="Edit supplier details"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDelete(supplier.supplier_id)}
                          title="Remove supplier"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info" className="mb-0">
            {isNewPart 
              ? "Save the part first, then you can add suppliers."
              : "No suppliers associated with this part. Click 'Add Supplier' to add one."}
          </Alert>
        )}
      </CardContent>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="supplier-select-label">Supplier</InputLabel>
              <Select
                labelId="supplier-select-label"
                value={formData.supplier_id || ''}
                label="Supplier"
                onChange={handleSelectChange}
                disabled={!!selectedSupplier}
              >
                <MenuItem value="">
                  <em>Select a supplier</em>
                </MenuItem>
                {getAvailableSuppliers().map((supplier) => (
                  <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              margin="normal"
              fullWidth
              label="Unit Cost"
              name="unit_cost"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={formData.unit_cost || 0}
              onChange={handleInputChange}
            />

            <TextField
              margin="normal"
              fullWidth
              label="Lead Time (days)"
              name="lead_time_days"
              type="number"
              inputProps={{ min: 0 }}
              value={formData.lead_time_days || 0}
              onChange={handleInputChange}
            />

            <TextField
              margin="normal"
              fullWidth
              label="Minimum Order Quantity"
              name="minimum_order_quantity"
              type="number"
              inputProps={{ min: 1 }}
              value={formData.minimum_order_quantity || 1}
              onChange={handleInputChange}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_preferred || false}
                  onChange={handleInputChange}
                  name="is_preferred"
                />
              }
              label="Preferred Supplier"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || !formData.supplier_id}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ManagePartSuppliers;
