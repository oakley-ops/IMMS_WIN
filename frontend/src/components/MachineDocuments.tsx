import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Badge
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Description as DescriptionIcon,
  GetApp as GetAppIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Clear as ClearIcon,
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useDropzone, FileRejection } from 'react-dropzone';
import { format } from 'date-fns';
import {
  MachineDocument,
  MachineDocumentUpload,
  DOCUMENT_CATEGORIES,
  getDocumentCategoryInfo
} from '../types/documents';
import {
  getMachineDocuments,
  uploadMachineDocument,
  downloadMachineDocument,
  viewMachineDocument,
  updateMachineDocument,
  deleteMachineDocument,
  searchMachineDocuments,
  formatFileSize,
  isImageFile,
  isPDFFile
} from '../services/machineDocumentsApi';

interface MachineDocumentsProps {
  machineId: number;
  machineName: string;
}

const MachineDocuments: React.FC<MachineDocumentsProps> = ({ machineId, machineName }) => {
  const [documents, setDocuments] = useState<MachineDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] = useState<MachineDocument | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredDocuments, setFilteredDocuments] = useState<MachineDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [contextMenuDocument, setContextMenuDocument] = useState<MachineDocument | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Upload form state
  const [uploadForm, setUploadForm] = useState<{
    file: File | null;
    category: MachineDocument['document_category'];
    title: string;
    description: string;
  }>({
    file: null,
    category: 'other',
    title: '',
    description: ''
  });

  // Edit form state
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    document_category: MachineDocument['document_category'];
  }>({
    title: '',
    description: '',
    document_category: 'other'
  });

  const [uploading, setUploading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setUploadForm(prev => ({
          ...prev,
          file,
          title: file.name
        }));
        setUploadDialogOpen(true);
      }
    },
    onDropRejected: (rejectedFiles: FileRejection[]) => {
      const rejection = rejectedFiles[0];
      let message = 'File upload failed';
      
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        message = 'File size must be less than 10MB';
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        message = 'Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, and CSV files are allowed.';
      }
      
      setSnackbar({
        open: true,
        message,
        severity: 'error'
      });
    }
  });

  // Load documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, [machineId]);

  // Filter documents based on search term and category
  useEffect(() => {
    let filtered = documents;
    
    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.document_category === selectedCategory);
    }
    
    setFilteredDocuments(filtered);
  }, [documents, searchTerm, selectedCategory]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMachineDocuments(machineId);
      setDocuments(response.data);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.response?.data?.error || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file) {
      setSnackbar({
        open: true,
        message: 'Please select a file to upload',
        severity: 'error'
      });
      return;
    }

    try {
      setUploading(true);
      const documentData: MachineDocumentUpload = {
        file: uploadForm.file,
        category: uploadForm.category,
        title: uploadForm.title,
        description: uploadForm.description
      };

      await uploadMachineDocument(machineId, documentData);
      
      setSnackbar({
        open: true,
        message: 'Document uploaded successfully',
        severity: 'success'
      });
      
      setUploadDialogOpen(false);
      setUploadForm({
        file: null,
        category: 'other',
        title: '',
        description: ''
      });
      
      fetchDocuments();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to upload document',
        severity: 'error'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentData: MachineDocument) => {
    try {
      const response = await downloadMachineDocument(machineId, documentData.document_id);
      const blob = new Blob([response.data], { type: documentData.mime_type });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = documentData.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSnackbar({
        open: true,
        message: 'Document downloaded successfully',
        severity: 'success'
      });
    } catch (err: any) {
      console.error('Error downloading document:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to download document',
        severity: 'error'
      });
    }
  };

  const canViewInline = (documentData: MachineDocument): boolean => {
    const mimeType = documentData.mime_type?.toLowerCase() || '';
    return (
      mimeType.includes('pdf') ||
      mimeType.includes('image') ||
      mimeType.includes('text') ||
      mimeType.includes('html')
    );
  };

  const handleView = async (documentData: MachineDocument) => {
    try {
      const viewUrl = await viewMachineDocument(machineId, documentData.document_id);
      const newWindow = window.open(viewUrl, '_blank');
      
      // Clean up the blob URL after a delay to prevent memory leaks
      setTimeout(() => {
        window.URL.revokeObjectURL(viewUrl);
      }, 60000); // Clean up after 1 minute
      
      if (newWindow) {
        if (canViewInline(documentData)) {
          setSnackbar({
            open: true,
            message: 'Document opened in new tab',
            severity: 'success'
          });
        } else {
          setSnackbar({
            open: true,
            message: 'Document opened in new tab (may download depending on browser settings)',
            severity: 'info'
          });
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Popup blocked - please allow popups for this site',
          severity: 'warning'
        });
      }
    } catch (err: any) {
      console.error('Error viewing document:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to open document',
        severity: 'error'
      });
    }
  };

  const handleEdit = (documentData: MachineDocument) => {
    setSelectedDocument(documentData);
    setEditForm({
      title: documentData.title,
      description: documentData.description,
      document_category: documentData.document_category
    });
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;

    try {
      setUpdating(true);
      await updateMachineDocument(machineId, selectedDocument.document_id, editForm);
      
      setSnackbar({
        open: true,
        message: 'Document updated successfully',
        severity: 'success'
      });
      
      setEditDialogOpen(false);
      setSelectedDocument(null);
      fetchDocuments();
    } catch (err: any) {
      console.error('Error updating document:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update document',
        severity: 'error'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = (documentData: MachineDocument) => {
    setSelectedDocument(documentData);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDocument) return;

    try {
      setDeleting(true);
      await deleteMachineDocument(machineId, selectedDocument.document_id);
      
      setSnackbar({
        open: true,
        message: 'Document deleted successfully',
        severity: 'success'
      });
      
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
      fetchDocuments();
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete document',
        severity: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, documentData: MachineDocument) => {
    setAnchorEl(event.currentTarget);
    setContextMenuDocument(documentData);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setContextMenuDocument(null);
  };

  const getCategoryCount = (category: string) => {
    return documents.filter(doc => doc.document_category === category).length;
  };

  const getDocumentIcon = (documentData: MachineDocument) => {
    const categoryInfo = getDocumentCategoryInfo(documentData.document_category);
    
    if (isImageFile(documentData.mime_type)) {
      return '🖼️';
    } else if (isPDFFile(documentData.mime_type)) {
      return '📄';
    } else if (documentData.document_type === 'doc' || documentData.document_type === 'docx') {
      return '📝';
    } else if (documentData.document_type === 'xls' || documentData.document_type === 'xlsx') {
      return '📊';
    } else {
      return categoryInfo.icon;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Documents for {machineName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage schematics, parts diagrams, PM instructions, and other documents
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Controls */}
      <Box mb={3}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchTerm('')} size="small">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories ({documents.length})</MenuItem>
              {DOCUMENT_CATEGORIES.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.icon} {category.label} ({getCategoryCount(category.value)})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Document
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Box 
          {...getRootProps()} 
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 6,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'primary.light' : 'grey.50',
            '&:hover': {
              bgcolor: 'grey.100'
            }
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isDragActive ? 'Drop the file here' : 'Drag & drop a document here, or click to select'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredDocuments.map((documentData) => {
            const categoryInfo = getDocumentCategoryInfo(documentData.document_category);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={documentData.document_id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Avatar
                        sx={{
                          bgcolor: categoryInfo.color,
                          width: 40,
                          height: 40,
                          mr: 2
                        }}
                      >
                        {getDocumentIcon(documentData)}
                      </Avatar>
                      <Box flexGrow={1}>
                        <Typography variant="h6" noWrap>
                          {documentData.title}
                        </Typography>
                        <Chip
                          label={categoryInfo.label}
                          size="small"
                          sx={{
                            bgcolor: `${categoryInfo.color}20`,
                            color: categoryInfo.color
                          }}
                        />
                      </Box>
                      <Tooltip title="More options">
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, documentData)}
                          size="small"
                          sx={{
                            border: '1px solid',
                            borderColor: 'grey.300',
                            '&:hover': {
                              bgcolor: 'grey.100',
                              borderColor: 'grey.400'
                            }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {documentData.description}
                    </Typography>

                    <Box mt={2}>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(documentData.file_size)} • {format(new Date(documentData.created_at), 'MMM d, yyyy')}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Uploaded by {documentData.created_by}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions 
                    sx={{ 
                      flexWrap: 'wrap',
                      gap: 0.5,
                      justifyContent: 'flex-start'
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleView(documentData)}
                      color="primary"
                      sx={{ minWidth: 'auto' }}
                    >
                      View
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownload(documentData)}
                      sx={{ minWidth: 'auto' }}
                    >
                      Download
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(documentData)}
                      sx={{ minWidth: 'auto' }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(documentData)}
                      color="error"
                      sx={{ minWidth: 'auto' }}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuList>
          <MenuItem onClick={() => contextMenuDocument && handleView(contextMenuDocument)}>
            <ListItemIcon>
              <ViewIcon />
            </ListItemIcon>
            <ListItemText>View</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => contextMenuDocument && handleDownload(contextMenuDocument)}>
            <ListItemIcon>
              <DownloadIcon />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => contextMenuDocument && handleEdit(contextMenuDocument)}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem 
            onClick={() => contextMenuDocument && handleDelete(contextMenuDocument)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <Grid container spacing={2}>
              {!uploadForm.file && (
                <Grid item xs={12}>
                  <Box 
                    {...getRootProps()} 
                    sx={{
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      cursor: 'pointer',
                      bgcolor: isDragActive ? 'primary.light' : 'grey.50'
                    }}
                  >
                    <input {...getInputProps()} />
                    <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop a document here, or click to select'}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {uploadForm.file && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    Selected file: {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value as any }))}
                >
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpload}
            variant="contained"
            disabled={!uploadForm.file || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Document</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Category"
                  value={editForm.document_category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, document_category: e.target.value as any }))}
                >
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateDocument}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={20} /> : <EditIcon />}
          >
            {updating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the document "{selectedDocument?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MachineDocuments; 