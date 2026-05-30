import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  Grid,
} from '@mui/material';
import BarcodeScanner from '../components/BarcodeScanner';
import axios from 'axios';
import { API_URL } from '../config';

const Scanner: React.FC = () => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleScan = async (result: string) => {
    try {
      setScannedCode(result);
      setError(null);
      setSuccess(null);

      // You can implement your logic here to handle the scanned code
      // For example, looking up a part by its barcode:
      const response = await axios.get(`${API_URL}/api/v1/parts/barcode/${result}`);
      if (response.data) {
        setSuccess(`Found part: ${response.data.name}`);
      } else {
        setError('No part found with this barcode');
      }
    } catch (err) {
      console.error('Error processing barcode:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to process barcode');
      } else {
        setError('Failed to process barcode');
      }
    }
  };

  const handleError = (error: string) => {
    setError(error);
    setSuccess(null);
  };

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Barcode Scanner
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Use this scanner to quickly look up parts by their barcode.
        </Typography>
      </Box>

      <Grid container>
        <Grid item xs={12} md={8} lg={6}>
          <BarcodeScanner
            onScan={handleScan}
            onError={handleError}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}

          {scannedCode && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Last scanned code: {scannedCode}
            </Alert>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default Scanner;
