import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { addPart } from '../store/partsSlice';
import { Part } from '../store/partsSlice';
import axiosInstance from '../utils/axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Radio,
  CircularProgress,
} from '@mui/material';
import { PRIMARY_ORANGE } from '../theme';

interface BinLocation {
  location_id: number;
  name: string;
  part_count: number;
}

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface PartSupplier {
  supplier_id: number;
  unit_cost: number;
  lead_time_days?: number;
  is_preferred: boolean;
}

const AddPart: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [manufacturerPartNumber, setManufacturerPartNumber] = useState('');
  const [internalPartNumber, setInternalPartNumber] = useState('');
  const [location, setLocation] = useState('');
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // New multi-supplier state
  const [selectedSuppliers, setSelectedSuppliers] = useState<PartSupplier[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState<number | ''>('');
  const [currentUnitCost, setCurrentUnitCost] = useState('');
  const [currentLeadTimeDays, setCurrentLeadTimeDays] = useState(0);

  const [unitCost, setUnitCost] = useState(0);
  const [minimumQuantity, setMinimumQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suppliers and bin locations on open
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (!response.ok) throw new Error('Failed to fetch suppliers');
        const data = await response.json();
        setSuppliers(data);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError('Failed to load suppliers. Please try again.');
      }
    };

    const fetchLocations = async () => {
      try {
        const { data } = await axiosInstance.get('/api/v1/parts/locations');
        setBinLocations(data);
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };

    if (show) {
      fetchSuppliers();
      fetchLocations();
    }
  }, [show]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setQuantity(0);
    setManufacturerPartNumber('');
    setInternalPartNumber('');
    setLocation('');
    setShowLocationDropdown(false);
    setSelectedSuppliers([]);
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays(0);
    setUnitCost(0);
    setMinimumQuantity(0);
    setNotes('');
    setError(null);
  };

  const handleAddSupplier = () => {
    if (currentSupplierId === '') {
      return;
    }

    // Check if supplier already exists in the list
    if (selectedSuppliers.some(s => s.supplier_id === Number(currentSupplierId))) {
      setError('This supplier is already added to the part.');
      return;
    }

    const newSupplier: PartSupplier = {
      supplier_id: Number(currentSupplierId),
      unit_cost: currentUnitCost === '' ? 0 : Number(currentUnitCost),
      lead_time_days: currentLeadTimeDays || undefined,
      is_preferred: selectedSuppliers.length === 0 // First supplier is automatically preferred
    };

    setSelectedSuppliers([...selectedSuppliers, newSupplier]);
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays(0);
    setError(null);
  };

  const handleRemoveSupplier = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.filter(s => s.supplier_id !== supplierId);

    // If the preferred supplier was removed, set the first supplier as preferred
    if (selectedSuppliers.find(s => s.supplier_id === supplierId)?.is_preferred && updatedSuppliers.length > 0) {
      updatedSuppliers[0].is_preferred = true;
    }

    setSelectedSuppliers(updatedSuppliers);
  };

  const handleSetPreferred = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.map(s => ({
      ...s,
      is_preferred: s.supplier_id === supplierId
    }));

    setSelectedSuppliers(updatedSuppliers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Get preferred supplier for primary details
    const preferredSupplier = selectedSuppliers.find(s => s.is_preferred);

    const newPart: Part = {
      part_id: 0,
      name,
      description,
      quantity,
      minimum_quantity: minimumQuantity,
      supplier_id: preferredSupplier ? preferredSupplier.supplier_id : undefined,
      unit_cost: preferredSupplier ? preferredSupplier.unit_cost : unitCost,
      location,
      manufacturer_part_number: manufacturerPartNumber,
      internal_part_number: internalPartNumber,
      status: 'active',
      notes,
      machine_id: 0,
      // Include the full suppliers data for backend processing
      suppliers: selectedSuppliers
    };

    try {
      await dispatch(addPart(newPart)).unwrap();
      resetForm();
      handleClose();
    } catch (err) {
      setError('Failed to add part. Please try again.');
      console.error('Failed to add part:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  return (
    <Dialog open={show} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: PRIMARY_ORANGE }}>Add New Part</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Name *"
                fullWidth
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Internal Part Number *"
                fullWidth
                size="small"
                value={internalPartNumber}
                onChange={(e) => setInternalPartNumber(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Manufacturer Part Number"
                fullWidth
                size="small"
                value={manufacturerPartNumber}
                onChange={(e) => setManufacturerPartNumber(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Quantity *"
                type="number"
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Minimum Quantity *"
                type="number"
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
                value={minimumQuantity}
                onChange={(e) => setMinimumQuantity(Number(e.target.value))}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box ref={locationRef} sx={{ position: 'relative' }}>
                <TextField
                  label="Location"
                  fullWidth
                  size="small"
                  value={location}
                  autoComplete="off"
                  placeholder="Type or select a bin..."
                  onChange={(e) => { setLocation(e.target.value); setShowLocationDropdown(true); }}
                  onFocus={() => setShowLocationDropdown(true)}
                />
                {showLocationDropdown && (
                  <Paper
                    elevation={4}
                    sx={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
                      maxHeight: 200, overflowY: 'auto',
                    }}
                  >
                    {binLocations
                      .filter(loc => loc.name.toLowerCase().includes(location.toLowerCase()))
                      .map(loc => (
                        <Box
                          key={loc.location_id}
                          onMouseDown={() => { setLocation(loc.name); setShowLocationDropdown(false); }}
                          sx={{
                            px: 2, py: 1, cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid', borderColor: 'divider',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <Typography variant="body2">{loc.name}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              px: 1, borderRadius: 3,
                              bgcolor: loc.part_count > 0 ? '#fff3cd' : '#d1e7dd',
                              color: loc.part_count > 0 ? '#856404' : '#0a3622',
                              fontWeight: 600,
                            }}
                          >
                            {loc.part_count > 0 ? `${loc.part_count} part${loc.part_count !== 1 ? 's' : ''}` : 'Available'}
                          </Typography>
                        </Box>
                      ))}
                    {binLocations.filter(loc => loc.name.toLowerCase().includes(location.toLowerCase())).length === 0 && location && (
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          New location: <strong>"{location}"</strong> will be created
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Suppliers Section */}
          <Box sx={{ mt: 4, mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ mb: 1 }}>Part Suppliers</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Important:</strong> Add one or more suppliers for this part. The first supplier added will be set as preferred.
            </Alert>

            {/* Add Supplier Form */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Add Supplier</Typography>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Supplier *</InputLabel>
                    <Select
                      value={currentSupplierId}
                      label="Supplier *"
                      onChange={(e) => setCurrentSupplierId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <MenuItem value=""><em>Select a supplier</em></MenuItem>
                      {suppliers.map((supplier) => (
                        <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                          {supplier.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="Unit Cost ($)"
                    type="number"
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={currentUnitCost}
                    onChange={(e) => setCurrentUnitCost(e.target.value)}
                    placeholder="$0.00"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="Lead Time (days)"
                    type="number"
                    fullWidth
                    size="small"
                    inputProps={{ min: 0 }}
                    value={currentLeadTimeDays}
                    onChange={(e) => setCurrentLeadTimeDays(Number(e.target.value))}
                  />
                </Grid>

                <Grid item xs={12} md={2}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAddSupplier}
                    disabled={currentSupplierId === ''}
                  >
                    Add Supplier
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Supplier List */}
            {selectedSuppliers.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Unit Cost</TableCell>
                      <TableCell>Lead Time</TableCell>
                      <TableCell>Preferred</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSuppliers.map((supplier) => (
                      <TableRow key={supplier.supplier_id}>
                        <TableCell>{getSupplierName(supplier.supplier_id)}</TableCell>
                        <TableCell>${supplier.unit_cost.toFixed(2)}</TableCell>
                        <TableCell>{supplier.lead_time_days || '-'}</TableCell>
                        <TableCell>
                          <Radio
                            checked={supplier.is_preferred}
                            onChange={() => handleSetPreferred(supplier.supplier_id)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={() => handleRemoveSupplier(supplier.supplier_id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="warning">
                <strong>No suppliers added yet.</strong> You must add at least one supplier for this part.
              </Alert>
            )}
          </Box>

          <TextField
            label="Description"
            fullWidth
            size="small"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes"
            fullWidth
            size="small"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading || selectedSuppliers.length === 0}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Adding...' : 'Add Part'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddPart;
