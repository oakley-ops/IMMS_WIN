import React, { useState } from 'react';
import { Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
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

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!validateCSV(file)) {
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Uploading file:', file.name);
      const response = await axios.post('http://localhost:3001/api/v1/parts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      console.log('Upload response:', response.data);
      setSuccess(`Successfully uploaded ${response.data.partsAdded} parts`);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('csvFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      // Refresh parts list
      dispatch(fetchParts());
    } catch (err) {
      console.error('Upload error:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || err.message || 'Failed to upload CSV file');
      } else {
        setError('Failed to upload CSV file');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="p-3">
      <h3 className="mb-3">Import Parts from CSV</h3>
      
      <Form onSubmit={handleUpload}>
        <Form.Group controlId="csvFile" className="mb-3">
          <Form.Label>Choose CSV File</Form.Label>
          <Form.Control
            type="file"
            onChange={handleFileChange}
            accept=".csv"
            disabled={uploading}
          />
          <Form.Text className="text-muted">
            File should be a CSV with headers: name, description, manufacturer_part_number, 
            fiserv_part_number, quantity, minimum_quantity, machine_id, supplier, unit_cost, location
          </Form.Text>
        </Form.Group>

        {uploading && (
          <div className="mb-3">
            <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
          </div>
        )}

        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-3">
            {success}
          </Alert>
        )}

        <Button 
          type="submit" 
          variant="primary"
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </Button>
      </Form>

      <div className="mt-4">
        <h5>CSV Format Example:</h5>
        <pre className="bg-light p-3 rounded">
          {`name,description,manufacturer_part_number,fiserv_part_number,quantity,minimum_quantity,machine_id,supplier,unit_cost,location
"Receipt Printer","Thermal printer","MPN123","FPN123",10,5,1,"Supplier A",99.99,"Shelf A1"
"Card Reader","EMV Reader","MPN456","FPN456",15,8,1,"Supplier B",149.99,"Shelf B2"`}
        </pre>
      </div>
    </div>
  );
};

export default CSVUploadForm;