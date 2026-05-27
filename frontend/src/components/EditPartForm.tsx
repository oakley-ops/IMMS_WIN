// src/components/EditPartForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchParts } from '../store/partsSlice';
import ManagePartSuppliers from './ManagePartSuppliers';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress,
} from '@mui/material';

interface BinLocation {
  location_id: number;
  name: string;
  part_count: number;
}

interface Machine {
  id: number;
  name: string;
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

interface PartFormData {
  name: string;
  description: string;
  quantity: number;
  manufacturer_part_number: string;
  internal_part_number: string;
  machine_id: number;
  unit_cost: number;
  location?: string;
  minimum_quantity?: number;
  status?: 'active' | 'discontinued';
  notes?: string;
  image?: string;
}

const EditPartForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<PartFormData>({
    name: '',
    description: '',
    quantity: 0,
    manufacturer_part_number: '',
    internal_part_number: '',
    machine_id: 0,
    unit_cost: 0,
    location: '',
    minimum_quantity: 0,
    status: 'active',
    notes: '',
    image: '',
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partId, setPartId] = useState<number | null>(id ? parseInt(id) : null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partResponse, machinesResponse, suppliersResponse, locationsResponse] = await Promise.all([
          id ? axiosInstance.get(`/api/v1/parts/${id}`) : Promise.resolve({ data: formData }),
          axiosInstance.get('/api/v1/machines'),
          axiosInstance.get('/api/v1/suppliers'),
          axiosInstance.get('/api/v1/parts/locations')
        ]);

        // Format the data
        const part = partResponse.data;
        setFormData({
          name: part.name || '',
          description: part.description || '',
          quantity: part.quantity || 0,
          manufacturer_part_number: part.manufacturer_part_number || '',
          internal_part_number: part.internal_part_number || '',
          machine_id: part.machine_id || 0,
          unit_cost: part.unit_cost || 0,
          location: part.location || '',
          minimum_quantity: part.minimum_quantity || 0,
          status: part.status || 'active',
          notes: part.notes || '',
          image: part.image || '',
        });

        setMachines(machinesResponse.data);
        setSuppliers(suppliersResponse.data);
        setBinLocations(locationsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;

    // Handle number inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: value === '' ? 0 : Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      // Convert empty strings to appropriate types for backend
      const dataToSubmit = {
        ...formData,
        quantity: typeof formData.quantity === 'string' ? Number(formData.quantity) : formData.quantity,
        minimum_quantity: typeof formData.minimum_quantity === 'string' ? Number(formData.minimum_quantity) : formData.minimum_quantity,
        unit_cost: typeof formData.unit_cost === 'string' ? Number(formData.unit_cost) : formData.unit_cost,
      };

      let savedPartId: number;

      if (id) {
        await axiosInstance.put(`/api/v1/parts/${id}`, dataToSubmit);
        savedPartId = parseInt(id);
        setSuccessMessage('Part updated successfully!');
      } else {
        const response = await axiosInstance.post('/api/v1/parts', dataToSubmit);
        savedPartId = response.data.part_id;
        setPartId(savedPartId); // Set the part ID for the supplier manager
        setSuccessMessage('Part created successfully!');
      }

      // Refresh parts list in Redux store
      dispatch(fetchParts());
    } catch (err) {
      console.error('Error submitting part:', err);
      setError('Failed to save part. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>{id ? 'Edit Part' : 'Add New Part'}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box component="form" onSubmit={handleSubmit}>
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Part Details</Typography>

              <TextField
                label="Name"
                fullWidth
                size="small"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />

              <TextField
                label="Internal Part Number"
                fullWidth
                size="small"
                id="internal_part_number"
                name="internal_part_number"
                value={formData.internal_part_number}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />

              <TextField
                label="Manufacturer Part Number"
                fullWidth
                size="small"
                id="manufacturer_part_number"
                name="manufacturer_part_number"
                value={formData.manufacturer_part_number}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Unit Cost ($)"
                type="number"
                fullWidth
                size="small"
                id="unit_cost"
                name="unit_cost"
                inputProps={{ min: 0, step: 0.01 }}
                value={formData.unit_cost}
                onChange={handleChange}
                placeholder="Leave blank for $0.00"
                sx={{ mb: 2 }}
              />

              <TextField
                label="Quantity"
                type="number"
                fullWidth
                size="small"
                id="quantity"
                name="quantity"
                inputProps={{ min: 0 }}
                value={formData.quantity}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />

              <TextField
                label="Minimum Quantity"
                type="number"
                fullWidth
                size="small"
                id="minimum_quantity"
                name="minimum_quantity"
                inputProps={{ min: 0 }}
                value={formData.minimum_quantity}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />

              {/* Location with autocomplete dropdown */}
              <Box ref={locationRef} sx={{ position: 'relative', mb: 2 }}>
                <TextField
                  label="Storage Location"
                  fullWidth
                  size="small"
                  id="location"
                  name="location"
                  autoComplete="off"
                  placeholder="Type or select a bin..."
                  value={formData.location || ''}
                  onChange={(e) => { handleChange(e); setShowLocationDropdown(true); }}
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
                      .filter(loc => loc.name.toLowerCase().includes((formData.location || '').toLowerCase()))
                      .map(loc => (
                        <Box
                          key={loc.location_id}
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, location: loc.name }));
                            setShowLocationDropdown(false);
                          }}
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
                    {binLocations.filter(loc => loc.name.toLowerCase().includes((formData.location || '').toLowerCase())).length === 0 && formData.location && (
                      <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          New location: <strong>"{formData.location}"</strong> will be created
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="machine-label">Associated Machine</InputLabel>
                <Select
                  labelId="machine-label"
                  id="machine_id"
                  name="machine_id"
                  value={formData.machine_id}
                  label="Associated Machine"
                  onChange={(e) => setFormData({ ...formData, machine_id: Number(e.target.value) })}
                >
                  <MenuItem value={0}>None</MenuItem>
                  {machines.map((machine) => (
                    <MenuItem key={machine.id} value={machine.id}>
                      {machine.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  id="status"
                  name="status"
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'discontinued' })}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="discontinued">Discontinued</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Description"
                fullWidth
                size="small"
                multiline
                rows={3}
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Notes"
                fullWidth
                size="small"
                multiline
                rows={3}
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                sx={{ mb: 3 }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {isSubmitting ? 'Saving...' : (id ? 'Update Part' : 'Create Part')}
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Managing Suppliers</Typography>
            <Typography variant="caption">
              {id
                ? "You can add multiple suppliers for this part. Set one as preferred for purchase orders."
                : "After saving the part, you'll be able to add multiple suppliers."}
            </Typography>
          </Alert>

          {/* Supplier Manager Section */}
          {id && (
            <ManagePartSuppliers partId={parseInt(id)} onUpdate={() => dispatch(fetchParts())} />
          )}

          {/* Show supplier manager for newly created parts */}
          {!id && partId && (
            <ManagePartSuppliers partId={partId} onUpdate={() => dispatch(fetchParts())} isNewPart={!id && !partId} />
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default EditPartForm;
