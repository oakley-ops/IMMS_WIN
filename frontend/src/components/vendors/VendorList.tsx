import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { vendorsApi } from '../../services/api';
import { Vendor } from '../../types/purchaseOrder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';

const VendorList: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await vendorsApi.getAll();
      setVendors(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError('Failed to load vendors. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (vendor: Vendor | null = null) => {
    if (vendor) {
      setCurrentVendor(vendor);
      setFormData({
        name: vendor.name,
        contact_name: vendor.contact_name || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        notes: vendor.notes || ''
      });
    } else {
      setCurrentVendor(null);
      setFormData({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentVendor(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSaveVendor = async () => {
    try {
      if (!formData.name) {
        setError('Vendor name is required');
        return;
      }

      if (currentVendor) {
        // Update existing vendor
        await vendorsApi.update(currentVendor.vendor_id, formData);
      } else {
        // Create new vendor
        await vendorsApi.create(formData);
      }

      // Refresh vendor list
      fetchVendors();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving vendor:', error);
      setError('Failed to save vendor. Please try again later.');
    }
  };

  const handleDeleteVendor = async (vendorId: number) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await vendorsApi.delete(vendorId);
        // Update vendors list
        setVendors(vendors.filter(vendor => vendor.vendor_id !== vendorId));
      } catch (error) {
        console.error('Error deleting vendor:', error);
        setError('Failed to delete vendor. Please try again later.');
      }
    }
  };

  return (
    <Box className="vendor-list" mb={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/purchase-orders')}
          variant="outlined"
        >
          Back to Purchase Orders
        </Button>
        
        <Button
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          variant="contained"
          color="primary"
        >
          Add Vendor
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom>
        Vendor Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={5}>
          <CircularProgress />
        </Box>
      ) : vendors.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            No vendors found. Add your first vendor to get started.
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
          >
            Add Vendor
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Contact Person</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.vendor_id}>
                  <TableCell>{vendor.name}</TableCell>
                  <TableCell>{vendor.contact_name || '-'}</TableCell>
                  <TableCell>{vendor.email || '-'}</TableCell>
                  <TableCell>{vendor.phone || '-'}</TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => handleOpenDialog(vendor)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => handleDeleteVendor(vendor.vendor_id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Vendor Form Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {currentVendor ? 'Edit Vendor' : 'Add New Vendor'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Vendor Name"
                value={formData.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                name="contact_name"
                label="Contact Person"
                value={formData.contact_name}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleInputChange}
                fullWidth
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                name="phone"
                label="Phone"
                value={formData.phone}
                onChange={handleInputChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                name="address"
                label="Address"
                value={formData.address}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="notes"
                label="Notes"
                value={formData.notes}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveVendor} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorList;
