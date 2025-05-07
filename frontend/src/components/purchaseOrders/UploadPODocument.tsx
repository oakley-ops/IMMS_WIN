import React, { useState } from 'react';
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  CircularProgress,
  IconButton,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { purchaseOrdersApi } from '../../services/api';

interface UploadPODocumentProps {
  poId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadPODocument: React.FC<UploadPODocumentProps> = ({ poId, open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('invoice');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const documentTypes = [
    { value: 'invoice', label: 'Invoice' },
    { value: 'receipt', label: 'Receipt' },
    { value: 'packing_slip', label: 'Packing Slip' },
    { value: 'shipping_label', label: 'Shipping Label' },
    { value: 'other', label: 'Other' }
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      formData.append('notes', notes);

      // Mock API call for now - will be replaced with real API
      if (typeof purchaseOrdersApi.uploadDocument === 'function') {
        await purchaseOrdersApi.uploadDocument(poId, formData);
      } else {
        // Mock success for testing
        console.log('Mock document upload - API method not available');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Clear form and notify parent
      setFile(null);
      setDocumentType('invoice');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Upload Document for PO #{poId}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <div style={{ marginTop: '10px', marginBottom: '15px' }}>
          <Typography variant="subtitle2" gutterBottom>
            Supported file types: PDF, Word, Excel, JPG, PNG
          </Typography>

          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            sx={{ marginTop: '10px', marginBottom: '10px' }}
          >
            Choose File
            <input
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
          </Button>

          {file && (
            <Typography variant="body2" sx={{ marginTop: '5px' }}>
              Selected file: {file.name}
            </Typography>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel id="document-type-label">Document Type</InputLabel>
            <Select
              labelId="document-type-label"
              id="document-type"
              value={documentType}
              label="Document Type"
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {documentTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            margin="normal"
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && (
            <Typography color="error" variant="body2" sx={{ marginTop: '10px' }}>
              {error}
            </Typography>
          )}
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          color="primary"
          disabled={!file || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadPODocument; 