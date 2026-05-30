import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Grid,
  Chip,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridPaginationModel,
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import CloseIcon from '@mui/icons-material/Close';
import axiosInstance from '../utils/axios';
import { Contact, ContactType, ContactStatus, ContactFormData } from '../types/contact';
import { format } from 'date-fns';
import { PRIMARY_ORANGE, COLOR_SUCCESS_BG, COLOR_ERROR_BG, COLOR_SUCCESS_TEXT, COLOR_ERROR_TEXT } from '../theme';

// Define contactsApi locally for now due to import issues - Updated
const contactsApi = {
  getAll: (type?: string, status?: string) => {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.append('type', type);
    if (status && status !== 'all') params.append('status', status);
    return axiosInstance.get(`/api/v1/contacts?${params.toString()}`);
  },
  getById: (id: number) => axiosInstance.get(`/api/v1/contacts/${id}`),
  create: (contactData: any) => axiosInstance.post('/api/v1/contacts', contactData),
  update: (id: number, contactData: any) => axiosInstance.put(`/api/v1/contacts/${id}`, contactData),
  delete: (id: number) => axiosInstance.delete(`/api/v1/contacts/${id}`),
};

const StyledDataGrid = styled(DataGrid, {
  shouldForwardProp: (prop) => ![
    'rowId',
    'offsetLeft',
    'columnsTotalWidth',
    'paginationMeta'
  ].includes(prop.toString()),
})({});

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ContactType>('all');
  const [filterStatus, setFilterStatus] = useState<ContactStatus>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(true);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState<boolean>(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    company: '',
    type: 'vendor',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
    status: 'active'
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const navigate = useNavigate();

  // Effect for filtering contacts based on search term and filters
  useEffect(() => {
    let filtered = contacts;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(contact => contact.type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(contact => contact.status === filterStatus);
    }

    // Filter by active only
    if (showActiveOnly) {
      filtered = filtered.filter(contact => contact.status === 'active');
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, filterType, filterStatus, showActiveOnly]);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching contacts...');
      const response = await contactsApi.getAll();
      console.log('Contacts response:', response);
      
      let contactsData: Contact[] = [];
      if (response.data && Array.isArray(response.data)) {
        contactsData = response.data;
      }
      
      setContacts(contactsData);
      setFilteredContacts(contactsData);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      const errorMessage = error.response ? 
        `Error ${error.response.status}: ${error.response.data}` : 
        error.message || 'Failed to load contacts';
      setError(errorMessage);
      setContacts([]);
      setFilteredContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Auto-clear success/error messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleOpenDialog = () => {
    setIsEditing(false);
    setSelectedContact(null);
    setOpenDialog(true);
    setError(null);
    setSuccess(null);
  };

  const handleOpenEditDialog = (contact: Contact) => {
    setIsEditing(true);
    setSelectedContact(contact);
    setFormData({
      name: contact.name || '',
      company: contact.company || '',
      type: contact.type || 'vendor',
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      city: contact.city || '',
      state: contact.state || '',
      zip_code: contact.zip_code || '',
      notes: contact.notes || '',
      status: contact.status || 'active'
    });
    setOpenDialog(true);
    setError(null);
    setSuccess(null);
  };

  const handleOpenDetailsDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setOpenDetailsDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setIsEditing(false);
    setSelectedContact(null);
    setFormData({
      name: '',
      company: '',
      type: 'vendor',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      status: 'active'
    });
  };

  const handleCloseDetailsDialog = () => {
    setOpenDetailsDialog(false);
    setSelectedContact(null);
  };

  const handleSubmitContact = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Basic validation
      if (!formData.name.trim()) {
        setError('Contact name is required');
        return;
      }
      if (!formData.company.trim()) {
        setError('Company is required');
        return;
      }
      if (!formData.email.trim()) {
        setError('Email is required');
        return;
      }
      if (!formData.phone.trim()) {
        setError('Phone is required');
        return;
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
      
      if (isEditing && selectedContact) {
        // Update existing contact
        const response = await contactsApi.update(selectedContact.contact_id, formData);
        console.log('Contact updated:', response.data);
        
        // Update contact in list
        const updatedContact = response.data;
        setContacts(prev => 
          prev.map(contact => 
            contact.contact_id === selectedContact.contact_id ? updatedContact : contact
          )
        );
        
        setSuccess('Contact updated successfully!');
      } else {
        // Create new contact
        const response = await contactsApi.create(formData);
        console.log('Contact created:', response.data);
        
        // Add new contact to list
        const newContact = response.data;
        setContacts(prev => [...prev, newContact]);
        
        setSuccess('Contact created successfully!');
      }
      
      handleCloseDialog();
      
    } catch (error: any) {
      console.error('Error submitting contact:', error);
      const errorMessage = error.response?.data?.error || error.message || 
        (isEditing ? 'Failed to update contact' : 'Failed to create contact');
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) {
      console.error('No Contact ID provided for deletion');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this contact?')) {
      try {
        setIsLoading(true);
        await contactsApi.delete(id);
        setContacts(contacts.filter(contact => contact.contact_id !== id));
        setSuccess('Contact deleted successfully');
      } catch (error: any) {
        console.error('Error deleting contact:', error);
        const errorMessage = error.response?.data?.error || 'Failed to delete contact';
        setError(errorMessage);
    } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);
      
      const contactsToExport = filteredContacts;
      if (contactsToExport.length === 0) {
        setError('No contacts to export');
        return;
      }

      // Transform data for export
      const exportData = contactsToExport.map((contact: Contact) => ({
        'Name': contact.name || '',
        'Company': contact.company || '',
        'Type': contact.type?.charAt(0).toUpperCase() + contact.type?.slice(1) || '',
        'Email': contact.email || '',
        'Phone': contact.phone || '',
        'Address': contact.address || '',
        'City': contact.city || '',
        'State': contact.state || '',
        'ZIP Code': contact.zip_code || '',
        'Status': contact.status?.toUpperCase() || '',
        'Notes': contact.notes || '',
        'Created Date': contact.created_at ? format(new Date(contact.created_at), 'MM/dd/yyyy') : 'N/A',
        'Updated Date': contact.updated_at ? format(new Date(contact.updated_at), 'MM/dd/yyyy') : 'N/A'
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Name
        { wch: 25 }, // Company
        { wch: 12 }, // Type
        { wch: 25 }, // Email
        { wch: 15 }, // Phone
        { wch: 30 }, // Address
        { wch: 15 }, // City
        { wch: 8 },  // State
        { wch: 12 }, // ZIP
        { wch: 10 }, // Status
        { wch: 30 }, // Notes
        { wch: 15 }, // Created
        { wch: 15 }, // Updated
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
      
      // Generate filename
      const filename = `contacts_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Contacts exported successfully!');
    } catch (error: any) {
      console.error('Error exporting contacts:', error);
      setError('Failed to export contacts');
    } finally {
      setExportLoading(false);
    }
  };

  // Define DataGrid columns
  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 150 },
    { field: 'company', headerName: 'Company', width: 200 },
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const getTypeColor = (type: string) => {
          switch (type?.toLowerCase()) {
            case 'vendor': return 'primary';
            case 'contractor': return 'success';
            case 'supplier': return 'info';
            default: return 'default';
          }
        };
        
        return (
          <Chip 
            label={params.value?.charAt(0).toUpperCase() + params.value?.slice(1) || 'N/A'} 
            size="small"
            color={getTypeColor(params.value) as any}
            variant="outlined"
          />
        );
      }
    },
    { 
      field: 'email', 
      headerName: 'Email', 
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon fontSize="small" sx={{ color: '#666' }} />
          <a href={`mailto:${params.value}`} style={{ textDecoration: 'none', color: PRIMARY_ORANGE }}>
            {params.value}
          </a>
        </Box>
      )
    },
    { 
      field: 'phone', 
      headerName: 'Phone', 
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneIcon fontSize="small" sx={{ color: '#666' }} />
          <a href={`tel:${params.value}`} style={{ textDecoration: 'none', color: PRIMARY_ORANGE }}>
            {params.value}
          </a>
        </Box>
      )
    },
    { 
      field: 'location', 
      headerName: 'Location', 
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <span>{params.row.city && params.row.state ? `${params.row.city}, ${params.row.state}` : 'N/A'}</span>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const isActive = params.value === 'active';
        return (
          <Chip 
            label={params.value || 'inactive'} 
            size="small"
            color={isActive ? 'success' : 'error'}
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => handleOpenDetailsDialog(params.row)}
            sx={{
              backgroundColor: 'secondary.main',
              color: 'white',
              '&:hover': { backgroundColor: 'secondary.dark' }
            }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleOpenEditDialog(params.row)}
            sx={{
              backgroundColor: PRIMARY_ORANGE,
              color: 'white',
              '&:hover': { backgroundColor: 'primary.dark' }
            }}
            title="Edit Contact"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.contact_id)}
            sx={{
              backgroundColor: 'error.main',
              color: 'white',
              '&:hover': { backgroundColor: 'error.dark' }
            }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <Container
      maxWidth="xl"
      sx={{
        backgroundColor: 'secondary.main',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        backgroundImage: 'linear-gradient(135deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 50%, rgba(0, 0, 0, 0.05) 50%, rgba(0, 0, 0, 0.05) 75%, transparent 75%, transparent)',
        backgroundSize: '20px 20px'
      }}
    >
      <Typography variant="h4" sx={{ color: PRIMARY_ORANGE, mb: 3, fontWeight: 'bold' }}>
        Contacts Management
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Actions */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by name, company, email, or type..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '0.5rem' }
                }}
              />
              {loading && searchTerm && (
                <LinearProgress color="primary" sx={{ mt: 1, height: '2px' }} />
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenDialog}
                  startIcon={<AddIcon />}
                  sx={{ minWidth: '140px' }}
                >
                  Add Contact
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleExportToExcel}
                  disabled={exportLoading}
                  startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  sx={{ minWidth: '120px' }}
                >
                  {exportLoading ? 'Exporting...' : 'Export'}
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Filters and Statistics */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => setFilterType(e.target.value as ContactType)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="vendor">Vendors</MenuItem>
                <MenuItem value="contractor">Contractors</MenuItem>
                <MenuItem value="supplier">Suppliers</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value as ContactStatus)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  color="primary"
                />
              }
              label="Show active only"
              sx={{ 
                '& .MuiFormControlLabel-label': { 
                  fontSize: '0.875rem',
                  color: '#666'
                }
              }}
            />
            
            <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
              <Chip
                label={`${filteredContacts.length} contacts showing`}
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${contacts.length} total contacts`}
                color="primary"
              />
              {searchTerm && (
                <Chip
                  label={`Search: "${searchTerm}"`}
                  color="secondary"
                  onDelete={() => setSearchTerm('')}
                />
              )}
            </Box>
          </Box>

          {/* Stats Cards */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<BusinessIcon />}
              label={`${contacts.filter(c => c.type === 'vendor').length} Vendors`}
              variant="outlined"
              color="primary"
            />
            <Chip
              icon={<BusinessIcon />}
              label={`${contacts.filter(c => c.type === 'contractor').length} Contractors`}
              variant="outlined"
              color="success"
            />
            <Chip
              icon={<BusinessIcon />}
              label={`${contacts.filter(c => c.type === 'supplier').length} Suppliers`}
              variant="outlined"
              color="info"
            />
          </Box>
        </Paper>

        {/* Contacts Table */}
        <Paper 
          elevation={0} 
          sx={{ 
            width: '100%', 
            mb: 3, 
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            backgroundColor: 'white'
          }}
        >
          <Box sx={{ width: '100%', height: 650 }}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress color="primary" />
                <Typography variant="body1" sx={{ mt: 2 }}>Loading contacts...</Typography>
              </Box>
            ) : error ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="error" gutterBottom>
                  Error Loading Contacts
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {error}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={fetchContacts}
                  startIcon={<RefreshIcon />}
                >
                  Retry
                </Button>
              </Box>
            ) : filteredContacts.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No contacts match your search' : 'No contacts found'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ?
                    'Try adjusting your search terms or clear the search to see all contacts.' :
                    'Use the "Add Contact" button to create your first contact.'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleOpenDialog}
                    startIcon={<AddIcon />}
                  >
                    Add Contact
                  </Button>
                )}
              </Box>
            ) : (
              <StyledDataGrid
                columns={columns}
                rows={filteredContacts}
                getRowId={(row) => row.contact_id}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                pageSizeOptions={[25, 50, 100]}
                disableRowSelectionOnClick
                disableColumnMenu
                onRowClick={(params) => handleOpenDetailsDialog(params.row)}
                sx={{
                  '& .MuiDataGrid-cell': {
                    py: 1.5,
                    px: 2
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: '#f8f9fa',
                    borderBottom: '2px solid #e9ecef',
                    py: 1.5
                  },
                  '& .MuiDataGrid-row': {
                    borderBottom: '1px solid #e9ecef',
                  },
                  '& .MuiDataGrid-row:hover': {
                    bgcolor: 'rgba(0, 102, 161, 0.04)',
                    cursor: 'pointer',
                  },
                  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                    outline: 'none',
                  },
                  border: 'none',
                  borderRadius: '0.75rem',
                  '& .MuiDataGrid-columnSeparator': {
                    display: 'none',
                  },
                  '& .MuiDataGrid-iconButtonContainer': {
                    color: 'secondary.main',
                  }
                }}
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Success/Error Feedback */}
      {(success || error) && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            maxWidth: '400px',
          }}
        >
          {success && (
            <Paper
              elevation={6}
              sx={{
                p: 2,
                backgroundColor: COLOR_SUCCESS_BG,
                color: COLOR_SUCCESS_TEXT,
                borderRadius: 2,
                mb: 1,
              }}
            >
              <Typography variant="body2">{success}</Typography>
            </Paper>
          )}
          {error && (
            <Paper
              elevation={6}
              sx={{
                p: 2,
                backgroundColor: COLOR_ERROR_BG,
                color: COLOR_ERROR_TEXT,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Add Contact Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: 'secondary.main', color: 'white', p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonAddIcon sx={{ mr: 1, color: PRIMARY_ORANGE }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                {isEditing ? 'Edit Contact' : 'Create New Contact'}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseDialog} size="small" sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'secondary.main', mb: 2, fontWeight: 'bold' }}>
              Basic Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  autoFocus
                  label="Contact Name"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company"
                  fullWidth
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Contact Type</InputLabel>
                  <Select
                    value={formData.type}
                    label="Contact Type"
                    onChange={(e) => setFormData({...formData, type: e.target.value as 'vendor' | 'contractor' | 'supplier'})}
                  >
                    <MenuItem value="vendor">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                        Vendor
                      </Box>
                    </MenuItem>
                    <MenuItem value="contractor">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <BusinessIcon sx={{ mr: 1, color: 'success.main' }} />
                        Contractor
                      </Box>
                    </MenuItem>
                    <MenuItem value="supplier">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <BusinessIcon sx={{ mr: 1, color: 'info.main' }} />
                        Supplier
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                  >
                    <MenuItem value="active">
                      <Chip label="Active" size="small" color="success" />
                    </MenuItem>
                    <MenuItem value="inactive">
                      <Chip label="Inactive" size="small" color="error" />
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'secondary.main', mb: 2, fontWeight: 'bold' }}>
              Contact Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: '#666' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  fullWidth
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ color: '#666' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'secondary.main', mb: 2, fontWeight: 'bold' }}>
              Address Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  fullWidth
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="City"
                  fullWidth
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="State"
                  fullWidth
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="ZIP Code"
                  fullWidth
                  value={formData.zip_code}
                  onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                />
              </Grid>
            </Grid>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ color: 'secondary.main', mb: 2, fontWeight: 'bold' }}>
              Additional Notes
            </Typography>
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Add any additional notes about this contact..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, backgroundColor: '#f8f9fa', borderTop: '1px solid #e9ecef' }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#666', alignSelf: 'center', fontStyle: 'italic' }}>
              * Required fields
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={handleCloseDialog}
                variant="outlined"
                sx={{ 
                  borderColor: '#666',
                  color: '#666',
                  minWidth: '100px',
                  '&:hover': { 
                    borderColor: '#333',
                    backgroundColor: 'rgba(102, 102, 102, 0.04)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitContact}
                variant="contained"
                color="primary"
                disabled={isSubmitting || !formData.name.trim() || !formData.company.trim() || !formData.email.trim() || !formData.phone.trim()}
                startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
                sx={{ minWidth: '140px' }}
              >
                {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Contact' : 'Create Contact')}
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Contact Details Dialog */}
      <Dialog
        open={openDetailsDialog}
        onClose={handleCloseDetailsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: 'secondary.main', color: 'white', p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <VisibilityIcon sx={{ mr: 1, color: PRIMARY_ORANGE }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                Contact Details
              </Typography>
            </Box>
            <IconButton onClick={handleCloseDetailsDialog} size="small" sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, maxHeight: '70vh', overflow: 'auto' }}>
          {selectedContact && (
            <Box>
              {/* Basic Information */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'secondary.main', mb: 1.5, fontWeight: 'bold' }}>
                  Basic Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Contact Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
                        {selectedContact.name || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Company
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
                        {selectedContact.company || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Type
                      </Typography>
                      <Chip 
                        label={selectedContact.type?.charAt(0).toUpperCase() + selectedContact.type?.slice(1) || 'N/A'} 
                        size="small"
                        color={
                          selectedContact.type === 'vendor' ? 'primary' :
                          selectedContact.type === 'contractor' ? 'success' :
                          selectedContact.type === 'supplier' ? 'info' : 'default'
                        }
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Status
                      </Typography>
                      <Chip 
                        label={selectedContact.status || 'inactive'} 
                        size="small"
                        color={selectedContact.status === 'active' ? 'success' : 'error'}
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Contact Information */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'secondary.main', mb: 1.5, fontWeight: 'bold' }}>
                  Contact Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Email
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" sx={{ color: '#666', fontSize: '1rem' }} />
                        <a 
                          href={`mailto:${selectedContact.email}`} 
                          style={{ textDecoration: 'none', color: PRIMARY_ORANGE, fontSize: '0.875rem' }}
                        >
                          {selectedContact.email || 'N/A'}
                        </a>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                        Phone
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon fontSize="small" sx={{ color: '#666', fontSize: '1rem' }} />
                        <a 
                          href={`tel:${selectedContact.phone}`} 
                          style={{ textDecoration: 'none', color: PRIMARY_ORANGE, fontSize: '0.875rem' }}
                        >
                          {selectedContact.phone || 'N/A'}
                        </a>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Address Information - Only show if there's address data */}
              {(selectedContact.address || selectedContact.city || selectedContact.state || selectedContact.zip_code) && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'secondary.main', mb: 1.5, fontWeight: 'bold' }}>
                    Address Information
                  </Typography>
                  <Grid container spacing={2}>
                    {selectedContact.address && (
                      <Grid item xs={12}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                            Address
                          </Typography>
                          <Typography variant="body1" sx={{ fontSize: '0.875rem' }}>
                            {selectedContact.address}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {(selectedContact.city || selectedContact.state || selectedContact.zip_code) && (
                      <Grid item xs={12}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: '#666', mb: 0.25, fontSize: '0.75rem' }}>
                            City, State ZIP
                          </Typography>
                          <Typography variant="body1" sx={{ fontSize: '0.875rem' }}>
                            {[selectedContact.city, selectedContact.state, selectedContact.zip_code]
                              .filter(Boolean)
                              .join(', ') || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}

              {/* Notes - Only show if there are notes */}
              {selectedContact.notes && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'secondary.main', mb: 1.5, fontWeight: 'bold' }}>
                    Notes
                  </Typography>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '0.5rem',
                      border: '1px solid #e9ecef'
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                      {selectedContact.notes}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Timestamps - Compact format */}
              <Box sx={{ borderTop: '1px solid #e9ecef', pt: 1.5 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      Created: {selectedContact.created_at ? 
                        format(new Date(selectedContact.created_at), 'MMM dd, yyyy') : 
                        'N/A'
                      }
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      Updated: {selectedContact.updated_at ? 
                        format(new Date(selectedContact.updated_at), 'MMM dd, yyyy') : 
                        'N/A'
                      }
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f8f9fa', borderTop: '1px solid #e9ecef' }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%', justifyContent: 'space-between' }}>
            <Button
              onClick={() => {
                handleCloseDetailsDialog();
                if (selectedContact) {
                  handleOpenEditDialog(selectedContact);
                }
              }}
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
            >
              Edit Contact
            </Button>
            <Button 
              onClick={handleCloseDetailsDialog}
              variant="outlined"
              sx={{ 
                borderColor: '#666',
                color: '#666',
                '&:hover': { 
                  borderColor: '#333',
                  backgroundColor: 'rgba(102, 102, 102, 0.04)'
                }
              }}
            >
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default Contacts;
