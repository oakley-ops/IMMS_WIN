import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchMachines } from '../store';
import { Machine } from '../types';

interface MachineFormData {
  name: string;
  model: string;
  serial_number: string;
  location: string;
  notes: string;
  manufacturer: string;
  status: string;
  installation_date: string;
}

interface ValidationErrors {
  name?: string;
  model?: string;
  serial_number?: string;
}

const MachineForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const [formData, setFormData] = useState<MachineFormData>({
    name: '',
    model: '',
    serial_number: '',
    location: '',
    notes: '',
    manufacturer: '',
    status: 'active',
    installation_date: ''
  });

  useEffect(() => {
    if (id) {
      fetchMachine();
    }
  }, [id]);

  const fetchMachine = async () => {
    try {
      setInitialLoading(true);
      const response = await axiosInstance.get(`/api/v1/machines/${id}`);
      setFormData(response.data);
    } catch (error: any) {
      console.error('Error fetching machine:', error);
      setError(error.response?.data?.message || 'Failed to fetch machine details');
    } finally {
      setInitialLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Machine name is required';
    }

    if (!formData.model.trim()) {
      errors.model = 'Model number is required';
    }

    if (!formData.serial_number.trim()) {
      errors.serial_number = 'Serial number is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error when field is edited
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const submissionData: MachineFormData = {
      ...formData,
      installation_date: formData.installation_date || '',
      location: formData.location || '',
      notes: formData.notes || '',
      manufacturer: formData.manufacturer || '',
      status: formData.status || 'active'
    };

    console.log('Submitting machine data:', submissionData);

    try {
      if (id) {
        await axiosInstance.put(`/api/v1/machines/${id}`, submissionData);
      } else {
        const response = await axiosInstance.post('/api/v1/machines', submissionData);
        console.log('Machine created:', response.data);
      }

      dispatch(fetchMachines());
      setSuccess(id ? 'Machine updated successfully!' : 'Machine created successfully!');

      setTimeout(() => {
        navigate('/machines');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving machine:', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'Failed to save machine');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 5 }}>
        <CircularProgress />
        <Typography sx={{ mt: 3 }} color="text.secondary">Loading machine details...</Typography>
      </Box>
    );
  }

  return (
    <Card sx={{ boxShadow: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" component="h2">{id ? 'Edit Machine' : 'Add New Machine'}</Typography>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={() => navigate('/machines')}
          >
            Back to Machines
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 4 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Machine Name *"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Model Number *"
                name="model"
                value={formData.model}
                onChange={handleChange}
                error={!!validationErrors.model}
                helperText={validationErrors.model}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Serial Number *"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                error={!!validationErrors.serial_number}
                helperText={validationErrors.serial_number}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Manufacturer"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Installation Date"
                type="date"
                name="installation_date"
                value={formData.installation_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                multiline
                rows={3}
                placeholder="Add any maintenance notes or special instructions..."
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate('/machines')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? 'Saving...' : 'Save Machine'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MachineForm;
