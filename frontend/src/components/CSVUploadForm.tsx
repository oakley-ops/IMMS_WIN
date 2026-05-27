import React, { useState } from 'react';
import {
  Box,
  Button,
  Alert,
  LinearProgress,
  Typography,
  CircularProgress,
} from '@mui/material';
import axiosInstance from '../utils/axios';
import { useDispatch } from 'react-redux';
import { fetchParts } from '../store/partsSlice';
import { AppDispatch } from '../store/store';

const CSVUploadForm: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      setFile(files[0]);
      setError(null);
      setSuccess(null);
    }
  };

  const validateCSV = (file: File): boolean => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/csv'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axiosInstance.post('/api/v1/parts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(`Successfully uploaded ${response.data.partsAdded || 'all'} parts`);
      // Reset file input
      const fileInput = document.getElementById('csvFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      // Reset file state
      setFile(null);
      // Refresh parts list
      dispatch(fetchParts());
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Import Parts from CSV</Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>Choose CSV File</Typography>
          <Button variant="outlined" component="label">
            {file ? file.name : 'Browse CSV File'}
            <input
              id="csvFile"
              type="file"
              hidden
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            File should be a CSV with headers: name, description, manufacturer_part_number,
            internal_part_number, quantity, minimum_quantity, machine_id, supplier, unit_cost, location
          </Typography>
        </Box>

        {uploading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={!file || uploading}
          startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </Button>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>CSV Format Example:</Typography>
        <Box
          component="pre"
          sx={{
            bgcolor: 'grey.100',
            p: 2,
            borderRadius: 1,
            fontSize: '0.8rem',
            overflow: 'auto',
          }}
        >
          {`name,description,manufacturer_part_number,internal_part_number,quantity,minimum_quantity,machine_id,supplier,unit_cost,location
"Receipt Printer","Thermal printer","MPN123","FPN123",10,5,1,"Supplier A",99.99,"Shelf A1"
"Card Reader","EMV Reader","MPN456","FPN456",15,8,1,"Supplier B",149.99,"Shelf B2"`}
        </Box>
      </Box>
    </Box>
  );
};

export default CSVUploadForm;
