import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Button,
  IconButton,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';
import { PODocument } from '../../types/documents';
import UploadPODocument from './UploadPODocument';
import * as documentApi from '../../services/documentApi';

interface SimplePODocumentsProps {
  poId: number;
}

const SimplePODocuments: React.FC<SimplePODocumentsProps> = ({ poId }) => {
  const [documents, setDocuments] = useState<PODocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState<boolean>(false);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [currentPreviewFileName, setCurrentPreviewFileName] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [documentToDelete, setDocumentToDelete] = useState<PODocument | null>(null);

  // Load documents when component mounts
  useEffect(() => {
    fetchDocuments();
  }, [poId]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching documents for PO ID:', poId);
      const response = await documentApi.getDocumentsByPOId(poId);
      console.log('Documents API response:', response);
      setDocuments(response.data || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      
      // Special handling for 404 (no documents yet)
      if (err.response && err.response.status === 404) {
        console.log('No documents found for this PO (404 response)');
        setDocuments([]);
      } else {
        setError(`Failed to load documents: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Download a document
   * @param documentId Document ID to download
   * @param fileName File name to use for the downloaded document
   */
  const handleDownload = async (documentId: number, fileName: string) => {
    console.log(`Attempting to download document ID: ${documentId}`);
    setIsLoading(true);
    
    try {
      // Get the document as a blob
      const blob = await documentApi.downloadPODocument(documentId);
      
      // Create URL and download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Use the provided filename or a fallback
      link.setAttribute('download', fileName || `document-${documentId}.pdf`);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url); // Free up memory
      
      console.log(`Download completed for document ID: ${documentId}`);
    } catch (error) {
      console.error(`Error downloading document:`, error);
      // enqueueSnackbar('Failed to download document. Please try again.', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Preview a document
   * @param documentId Document ID to preview
   * @param fileName File name of the document
   */
  const handlePreview = async (documentId: number, fileName: string) => {
    console.log(`Attempting to preview document ID: ${documentId}`);
    setIsLoading(true);
    
    try {
      // Get the document as a blob
      const blob = await documentApi.downloadPODocument(documentId);
      
      // Create URL for preview
      const url = window.URL.createObjectURL(blob);
      
      // Set the current preview URL and file name
      setCurrentPreviewUrl(url);
      setCurrentPreviewFileName(fileName);
      
      // Open the preview dialog
      setPreviewDialogOpen(true);
      
      console.log(`Preview ready for document ID: ${documentId}`);
    } catch (error) {
      console.error(`Error previewing document:`, error);
      // Display error message if needed
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePreview = () => {
    // Close the preview dialog
    setPreviewDialogOpen(false);
    
    // Clean up the object URL when closing the preview
    if (currentPreviewUrl) {
      window.URL.revokeObjectURL(currentPreviewUrl);
      setCurrentPreviewUrl(null);
    }
  };

  /**
   * Open the delete confirmation dialog
   * @param doc Document to delete
   */
  const handleOpenDeleteDialog = (doc: PODocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  /**
   * Close the delete confirmation dialog
   */
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  /**
   * Delete a document after confirmation
   */
  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setIsLoading(true);
    try {
      await documentApi.deleteDocument(documentToDelete.document_id);
      
      // Close the dialog
      handleCloseDeleteDialog();
      
      // Refresh the document list
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      // Handle error if needed
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUploadDialog = () => {
    setUploadDialogOpen(true);
  };

  const handleCloseUploadDialog = () => {
    setUploadDialogOpen(false);
  };

  const handleUploadSuccess = () => {
    // Refresh the documents list after successful upload
    fetchDocuments();
  };

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', padding: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
        <Typography variant="h6">Documents</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<FileUploadIcon />} 
          onClick={handleOpenUploadDialog}
        >
          Upload Document
        </Button>
      </Box>

      {documents.length === 0 ? (
        <Alert severity="info" sx={{ margin: 2 }}>
          No documents available for this purchase order
        </Alert>
      ) : (
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="documents table">
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.document_id}>
                  <TableCell>{doc.file_name}</TableCell>
                  <TableCell>{doc.document_type}</TableCell>
                  <TableCell>
                    {doc.created_at ? format(new Date(doc.created_at), 'MM/dd/yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell>{doc.created_by || 'N/A'}</TableCell>
                  <TableCell>{doc.notes || 'N/A'}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <IconButton 
                        color="primary" 
                        onClick={() => handlePreview(doc.document_id, doc.file_name)}
                        title="Preview"
                        size="small"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        color="primary" 
                        onClick={() => handleDownload(doc.document_id, doc.file_name)}
                        title="Download"
                        size="small"
                      >
                        <CloudDownloadIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        onClick={() => handleOpenDeleteDialog(doc)}
                        title="Delete"
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Document Dialog */}
      <UploadPODocument
        poId={poId}
        open={uploadDialogOpen}
        onClose={handleCloseUploadDialog}
        onSuccess={handleUploadSuccess}
      />

      {/* Document Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {currentPreviewFileName}
            </Typography>
            <IconButton onClick={handleClosePreview} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ height: '70vh' }}>
          {currentPreviewUrl && (
            currentPreviewFileName.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={`${currentPreviewUrl}#toolbar=0`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="PDF Preview"
              />
            ) : currentPreviewFileName.toLowerCase().match(/\.(jpeg|jpg|png|gif)$/i) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
                <img 
                  src={currentPreviewUrl} 
                  alt={currentPreviewFileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1">
                  Preview not available for this file type. Please download the file to view it.
                </Typography>
              </Box>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
          {currentPreviewUrl && (
            <Button 
              variant="contained" 
              startIcon={<CloudDownloadIcon />}
              onClick={() => {
                // Find the document ID for the current preview
                const doc = documents.find(d => d.file_name === currentPreviewFileName);
                if (doc) {
                  handleDownload(doc.document_id, doc.file_name);
                }
              }}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{documentToDelete?.file_name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SimplePODocuments;