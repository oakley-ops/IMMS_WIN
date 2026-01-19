import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  AlertTitle,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import ManualPOEntryDialog from './ManualPOEntryDialog';

interface ImportResult {
  success: boolean;
  po_id: number;
  po_number: string;
  supplier: {
    id: number;
    name: string;
    created: boolean;
  };
  stats: {
    total_items: number;
    matched_parts: number;
    created_parts: number;
  };
  created_parts: Array<{
    part_id: number;
    name: string;
    manufacturer_part_number: string | null;
  }>;
}

interface POImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const POImportDialog: React.FC<POImportDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed:', e.target.files);
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    console.log('Processing file:', file.name, file.type, file.size);
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      console.log('Sending import request to:', `${API_URL}/api/v1/purchase-orders/import-from-pdf`);
      console.log('Auth token exists:', !!token);
      
      const response = await axios.post<ImportResult>(
        `${API_URL}/api/v1/purchase-orders/import-from-pdf`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      console.log('Import response:', response.data);
      setResult(response.data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'Failed to import PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleViewPO = () => {
    if (result) {
      navigate(`/purchase-orders/${result.po_id}`);
      onClose();
    }
  };

  const handleImportAnother = () => {
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Import Purchase Order from PDF</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!result && !uploading && (
          <>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              style={{ display: 'none' }}
              accept=".pdf"
              onChange={handleFileInput}
            />
            <label htmlFor="file-upload" style={{ width: '100%', display: 'block' }}>
              <Paper
                elevation={0}
                sx={{
                  border: dragActive ? '2px dashed #FF6600' : '2px dashed #ccc',
                  backgroundColor: dragActive ? 'rgba(255, 102, 0, 0.05)' : 'transparent',
                  borderRadius: 2,
                  p: 8,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 102, 0, 0.02)',
                    borderColor: '#FF6600',
                  },
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <UploadIcon sx={{ fontSize: 64, color: '#999', mb: 2 }} />
                <Typography variant="body1" fontWeight="medium" gutterBottom>
                  Drop PDF here or click to upload
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  PDF files only (max 10MB)
                </Typography>
              </Paper>
            </label>
          </>
        )}

        {uploading && (
          <Box textAlign="center" py={8}>
            <CircularProgress size={60} sx={{ color: '#FF6600' }} />
            <Typography variant="h6" mt={3}>
              Extracting data from PDF...
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              This may take a few moments
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Automatic Import Failed</AlertTitle>
            {error}
            <Box mt={2} display="flex" gap={1}>
              <Button
                variant="contained"
                color="error"
                onClick={handleImportAnother}
                size="small"
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setShowManualEntry(true)}
                size="small"
              >
                Enter Data Manually
              </Button>
            </Box>
          </Alert>
        )}

        {result && (
          <Box>
            {/* Success message */}
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
              <AlertTitle>PO {result.po_number} created successfully!</AlertTitle>
            </Alert>

            {/* Stats */}
            <Paper elevation={2} sx={{ p: 3, mb: 2, backgroundColor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Import Summary
              </Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mt={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Supplier
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {result.supplier.name}
                    {result.supplier.created && (
                      <Chip
                        label="NEW"
                        size="small"
                        color="success"
                        sx={{ ml: 1, height: 20 }}
                      />
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Items
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {result.stats.total_items}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Parts Matched
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {result.stats.matched_parts}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    New Parts Created
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {result.stats.created_parts}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Created parts list */}
            {result.created_parts.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>New Parts Created</AlertTitle>
                <List dense>
                  {result.created_parts.map((part) => (
                    <ListItem key={part.part_id} disablePadding>
                      <ListItemText
                        primary={part.name}
                        secondary={part.manufacturer_part_number}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      {result && (
        <DialogActions>
          <Button onClick={handleImportAnother} variant="outlined">
            Import Another
          </Button>
          <Button
            onClick={handleViewPO}
            variant="contained"
            sx={{
              backgroundColor: '#FF6600',
              '&:hover': { backgroundColor: '#e65c00' },
            }}
          >
            View Purchase Order
          </Button>
        </DialogActions>
      )}

      {/* Manual Entry Dialog */}
      <ManualPOEntryDialog
        isOpen={showManualEntry}
        onClose={() => {
          setShowManualEntry(false);
          setSelectedFile(null);
          setError(null);
        }}
        onSuccess={() => {
          setShowManualEntry(false);
          if (onSuccess) {
            onSuccess();
          }
          onClose();
        }}
        pdfFile={selectedFile}
      />
    </Dialog>
  );
};

export default POImportDialog;
