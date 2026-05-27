import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchParts } from '../store/partsSlice';
import BarcodeScanner from './BarcodeScanner';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Grid,
  CircularProgress,
} from '@mui/material';

interface PartFormData {
  name: string;
  description: string;
  quantity: number;
  minimum_quantity: number;
  manufacturer_part_number: string;
  internal_part_number: string;
  machine_id: number;
  supplier: string;
  unit_cost: number;
  location: string;
  notes: string;
  image: string;
}

const PartForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<PartFormData>({
    name: '',
    description: '',
    quantity: 0,
    minimum_quantity: 0,
    manufacturer_part_number: '',
    internal_part_number: '',
    machine_id: 0,
    supplier: '',
    unit_cost: 0,
    location: '',
    notes: '',
    image: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTBD, setIsTBD] = useState<boolean>(false);
  const [uniqueTBD, setUniqueTBD] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate a unique TBD value when the component mounts
  useEffect(() => {
    generateUniqueTBD();
  }, []);

  const generateUniqueTBD = () => {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    const newUniqueTBD = `TBD-${timestamp}-${random}`;
    setUniqueTBD(newUniqueTBD);
    return newUniqueTBD;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;

    // Special handling for internal_part_number
    if (name === 'internal_part_number') {
      const upperValue = value.trim().toUpperCase();
      if (upperValue === 'TBD') {
        setIsTBD(true);
      } else {
        setIsTBD(false);
      }
    }

    // Handle numeric inputs
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

    // Clear error when user starts typing
    setError(null);
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    // Decide whether to populate manufacturer_part_number or internal_part_number
    // based on the scanned barcode format or user input
    setFormData({
      ...formData,
      manufacturer_part_number: scannedBarcode,
      // or
      // internal_part_number: scannedBarcode
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    // Reset status messages
    setError(null);
    setSuccess(null);

    // Validate required fields
    if (!formData.name) {
      setError('Part name is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.internal_part_number && !isTBD) {
      setError('internal part number is required (you can use "TBD" if unknown)');
      setIsSubmitting(false);
      return;
    }

    // Create a copy of the form data to modify if needed
    const submissionData = { ...formData };

    // If the user entered TBD, use our pre-generated unique TBD value
    if (isTBD || submissionData.internal_part_number.trim().toUpperCase() === "TBD") {
      submissionData.internal_part_number = uniqueTBD;
      console.log('Using unique TBD value:', uniqueTBD);
    }

    try {
      // Send the modified data to the backend
      console.log('Submitting data:', submissionData);
      const response = await axios.post('/api/v1/parts', submissionData);
      console.log('Response:', response);

      // Dispatch an action to update the parts list in the Redux store
      dispatch(fetchParts());

      // Generate a new unique TBD for next time
      generateUniqueTBD();

      // Reset the form or show a success message
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        minimum_quantity: 0,
        manufacturer_part_number: '',
        internal_part_number: '',
        machine_id: 0,
        supplier: '',
        unit_cost: 0,
        location: '',
        notes: '',
        image: '',
      });
      setIsTBD(false);
      setSuccess('Part created successfully!');
    } catch (error) {
      console.error('Error creating part:', error);

      // Check for unique constraint violation on internal_part_number
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error response:', error.response);
        const errorMessage = error.response.data.error || error.message;

        if (errorMessage.includes('unique_internal_part_number') ||
            errorMessage.includes('duplicate key value') ||
            errorMessage.includes('Key (internal_part_number)')) {

          // Generate a new unique TBD and suggest trying again
          const newUniqueTBD = generateUniqueTBD();

          if (isTBD || formData.internal_part_number.trim().toUpperCase() === "TBD") {
            setError(`There's already a part with "TBD" as the internal part number. We've generated a new unique ID "${newUniqueTBD}" for you. Please try submitting again.`);
          } else {
            setError(`A part with this internal part number already exists. Please use a different value.`);
          }
        } else {
          setError(`Error: ${errorMessage}`);
        }
      } else {
        setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" gutterBottom>Create Part</Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
      )}

      <BarcodeScanner onScan={handleBarcodeScanned} />

      <TextField
        label={<>Part Name <span style={{ color: 'red' }}>*</span></>}
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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Manufacturer Part Number"
            fullWidth
            size="small"
            id="manufacturer_part_number"
            name="manufacturer_part_number"
            value={formData.manufacturer_part_number}
            onChange={handleChange}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label={<>Internal Part Number <span style={{ color: 'red' }}>*</span></>}
            fullWidth
            size="small"
            id="internal_part_number"
            name="internal_part_number"
            value={formData.internal_part_number}
            onChange={handleChange}
            required
            helperText='If you don&apos;t have the internal part number yet, enter "TBD".'
          />
          {isTBD && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight={600}>TBD Detected</Typography>
              <Typography variant="caption">
                We'll use this unique ID: <code>{uniqueTBD}</code>
              </Typography>
            </Alert>
          )}
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <TextField
            label={<>Quantity <span style={{ color: 'red' }}>*</span></>}
            type="number"
            fullWidth
            size="small"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            inputProps={{ min: 0 }}
            required
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label={<>Minimum Quantity <span style={{ color: 'red' }}>*</span></>}
            type="number"
            fullWidth
            size="small"
            id="minimum_quantity"
            name="minimum_quantity"
            value={formData.minimum_quantity}
            onChange={handleChange}
            inputProps={{ min: 0 }}
            required
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label="Unit Cost"
            type="number"
            fullWidth
            size="small"
            id="unit_cost"
            name="unit_cost"
            value={formData.unit_cost}
            onChange={handleChange}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
      </Grid>

      <TextField
        label="Supplier/Manufacturer"
        fullWidth
        size="small"
        id="supplier"
        name="supplier"
        value={formData.supplier}
        onChange={handleChange}
        sx={{ mb: 2 }}
      />

      <TextField
        label="Location"
        fullWidth
        size="small"
        id="location"
        name="location"
        value={formData.location}
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

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {isSubmitting ? 'Creating...' : 'Create Part'}
      </Button>
    </Box>
  );
};

export default PartForm;
