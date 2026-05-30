import React, { useState, useEffect } from 'react';
import { PRIMARY_ORANGE } from '../../../theme';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Delete,
  Search,
  Description,
  Image,
  PictureAsPdf,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface DieDocumentsTabProps {
  dieId: number;
  onRefresh: () => void;
}

const DieDocumentsTab: React.FC<DieDocumentsTabProps> = ({ dieId, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [dieId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/die-documents/dies/${dieId}/documents`, {
        headers,
      });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId: number, fileName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/die-documents/documents/${documentId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/die-documents/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDocuments();
      onRefresh();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: any = {
      purchase_order: '#2196F3',
      invoice: '#FF9800',
      inspection_report: '#4CAF50',
      sharpening_receipt: '#9C27B0',
      specification: '#00BCD4',
      other: '#9E9E9E',
    };
    return colors[category] || '#9E9E9E';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <PictureAsPdf sx={{ fontSize: 48, color: '#F44336' }} />;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || ''))
      return <Image sx={{ fontSize: 48, color: '#2196F3' }} />;
    return <Description sx={{ fontSize: 48, color: '#9E9E9E' }} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const filteredDocuments = documents.filter((doc) => {
    const query = searchQuery.toLowerCase();
    return (
      doc.file_name.toLowerCase().includes(query) ||
      doc.title.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query) ||
      doc.related_po_number?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Search documents..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<CloudUpload />}
          sx={{ bgcolor: PRIMARY_ORANGE, '&:hover': { bgcolor: '#E55A00' } }}
        >
          Upload Document
        </Button>
      </Box>

      {filteredDocuments.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">
            {searchQuery ? 'No documents match your search.' : 'No documents attached yet.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredDocuments.map((doc) => (
            <Grid item xs={12} sm={6} md={4} key={doc.document_id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    {getFileIcon(doc.file_name)}
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 'bold', mb: 1 }}
                    noWrap
                    title={doc.title}
                  >
                    {doc.title}
                  </Typography>
                  <Chip
                    label={doc.document_category.replace(/_/g, ' ').toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: getCategoryColor(doc.document_category),
                      color: 'white',
                      mb: 1,
                    }}
                  />
                  {doc.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {doc.description}
                    </Typography>
                  )}
                  <Box sx={{ mt: 'auto' }}>
                    {doc.related_po_number && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        PO: {doc.related_po_number}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" display="block">
                      Size: {formatFileSize(doc.file_size)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Uploaded: {formatDate(doc.created_at)}
                    </Typography>
                    {doc.uploaded_by_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        By: {doc.uploaded_by_name}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleDownload(doc.document_id, doc.file_name)}
                  >
                    Download
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(doc.document_id)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default DieDocumentsTab;
