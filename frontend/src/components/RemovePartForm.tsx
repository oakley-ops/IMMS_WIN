// src/components/RemovePartForm.tsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchParts } from '../store/partsSlice';
import axiosInstance from '../utils/axios';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';

const RemovePartForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [barcode, setBarcode] = useState('');
  const [quantityToRemove, setQuantityToRemove] = useState(1); // Default to removing 1 item
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!barcode) {
      setError('Please scan a barcode first.');
      setLoading(false);
      return;
    }

    try {
      await axiosInstance.post('/api/v1/parts/remove', {
        barcode,
        quantity: quantityToRemove
      });
      dispatch(fetchParts());
      setBarcode('');
      setQuantityToRemove(1); // Reset quantity
      alert('Part removed from inventory.');
    } catch (err) {
      console.error('Error removing part:', err);
      setError('Failed to remove part. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        label="Barcode"
        fullWidth
        size="small"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder="Scan or enter barcode"
        required
        sx={{ mb: 2 }}
      />

      <TextField
        label="Quantity to Remove"
        type="number"
        fullWidth
        size="small"
        inputProps={{ min: 1 }}
        value={quantityToRemove}
        onChange={(e) => setQuantityToRemove(parseInt(e.target.value))}
        required
        sx={{ mb: 2 }}
      />

      <Button
        variant="contained"
        color="primary"
        type="submit"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {loading ? 'Removing...' : 'Remove Part'}
      </Button>
    </Box>
  );
};

export default RemovePartForm;
