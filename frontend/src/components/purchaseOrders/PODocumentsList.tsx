import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  CircularProgress,
  Box,
  Alert
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import * as apiService from '../../services/api';
import { PODocument } from '../../types/documents';

// Get the purchaseOrdersApi directly
const { purchaseOrdersApi } = apiService;

interface PODocumentsListProps {
  poId: number;
}

const PODocumentsList: React.FC<PODocumentsListProps> = ({ poId }) => {
  const [documents, setDocuments] = useState<PODocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        console.log('PODocumentsList: Fetching documents for PO ID:', poId);
        
        // Check if the function exists
        if (typeof purchaseOrdersApi.getDocumentsByPOId !== 'function') {
          console.error('getDocumentsByPOId is not a function!', purchaseOrdersApi);
          throw new Error('API method not available: getDocumentsByPOId');
        }
        
        const response = await purchaseOrdersApi.getDocumentsByPOId(poId);
        console.log('Documents API response:', response);
        
        setDocuments(response.data || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching documents:', err);
        setError(`Failed to load documents: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [poId]);

  const handleDownload = async (documentId: number) => {
    try {
      console.log('Attempting to download document ID:', documentId);
      
      // Check if the function exists
      if (typeof purchaseOrdersApi.downloadPODocument !== 'function') {
        console.error('downloadPODocument is not a function!', purchaseOrdersApi);
        throw new Error('API method not available: downloadPODocument');
      }
      
      await purchaseOrdersApi.downloadPODocument(documentId);
    } catch (err: any) {
      console.error('Error downloading document:', err);
      window.alert(`Failed to download document: ${err.message || 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box my={2}>
        <Alert severity="error">{error}</Alert>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Please try again later or contact support if the problem persists.
        </Typography>
      </Box>
    );
  }

  if (documents.length === 0) {
    return (
      <Box my={2}>
        <Typography variant="body1">No documents available for this purchase order</Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', mt: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Purchase Order Documents
      </Typography>
      <TableContainer sx={{ maxHeight: 440 }}>
        <Table stickyHeader aria-label="purchase order documents table">
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.document_id} hover>
                <TableCell>{doc.file_name}</TableCell>
                <TableCell>{doc.document_type}</TableCell>
                <TableCell>{formatDate(doc.created_at)}</TableCell>
                <TableCell>{doc.created_by}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    onClick={() => handleDownload(doc.document_id)}
                  >
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default PODocumentsList; 