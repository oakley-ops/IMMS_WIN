import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload,
  Description,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface DocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record?: any;
  dieId?: number;
}

const DocumentUploadDialog: React.FC<DocumentUploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  record,
  dieId,
}) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    document_category: 'purchase_order',
    title: '',
    description: '',
    related_po_number: '',
    document_date: new Date().toISOString().split('T')[0],
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF and image files are allowed');
        return;
      }

      setSelectedFile(file);
      setError(null);

      if (!formData.title) {
        setFormData((prev) => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, ''),
        }));
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();

      formDataToSend.append('file', selectedFile);
      formDataToSend.append('document_category', formData.document_category);
      formDataToSend.append('title', formData.title || selectedFile.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('related_po_number', formData.related_po_number);
      formDataToSend.append('document_date', formData.document_date);

      if (record) {
        formDataToSend.append('sharpening_id', record.sharpening_id.toString());
      }

      const endpoint = record
        ? `${API_URL}/die-documents/sharpening/${record.sharpening_id}/documents`
        : `${API_URL}/die-documents/dies/${dieId}/documents`;

      await axios.post(endpoint, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFormData({
      document_category: 'purchase_order',
      title: '',
      description: '',
      related_po_number: '',
      document_date: new Date().toISOString().split('T')[0],
    });
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Document</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {record && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Die: <strong>{record.die_number}</strong> - {record.die_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sharpening Record #{record.sharpening_id}
            </Typography>
          </Box>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: selectedFile ? '#e8f5e9' : '#fafafa',
                '&:hover': {
                  bgcolor: '#f5f5f5',
                  borderColor: '#999',
                },
              }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {selectedFile ? (
                <>
                  <Description sx={{ fontSize: 48, color: '#4CAF50', mb: 1 }} />
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }}>
                    Change File
                  </Button>
                </>
              ) : (
                <>
                  <CloudUpload sx={{ fontSize: 48, color: '#999', mb: 1 }} />
                  <Typography variant="body1">
                    Click to select or drag and drop
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    PDF, JPG, PNG, GIF (Max 10MB)
                  </Typography>
                </>
              )}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Document Category"
              value={formData.document_category}
              onChange={(e) => handleChange('document_category', e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="purchase_order">Purchase Order</option>
              <option value="invoice">Invoice</option>
              <option value="inspection_report">Inspection Report</option>
              <option value="sharpening_receipt">Sharpening Receipt</option>
              <option value="specification">Specification Sheet</option>
              <option value="other">Other</option>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., PO from Precision Services"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional notes about this document"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Related PO Number"
              value={formData.related_po_number}
              onChange={(e) => handleChange('related_po_number', e.target.value)}
              placeholder="PO-2024-####"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Document Date"
              value={formData.document_date}
              onChange={(e) => handleChange('document_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              Uploading... {uploadProgress}%
            </Typography>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            PDF files will be automatically processed for text search. This may take a few seconds.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedFile}
          startIcon={<CloudUpload />}
          sx={{
            bgcolor: '#FF6600',
            '&:hover': { bgcolor: '#E55A00' },
          }}
        >
          {loading ? <CircularProgress size={24} /> : 'Upload Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentUploadDialog;
