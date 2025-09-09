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
  FilterList as FilterListIcon,
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
import { Contact, ContactType, ContactStatus } from '../types/contact';
import { format } from 'date-fns';

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

// Custom CSS styles for Fiserv branding
const FiservStyles = `
  .text-primary {
    color: #FF6600 !important;
  }
  
  .bg-primary {
    background-color: #0066A1 !important;
  }
  
  .form-check-input:checked {
    background-color: #FF6600;
    border-color: #FF6600;
  }
  
  .border-primary {
    border-color: #FF6600 !important;
  }
  
  a {
    color: #FF6600;
  }
  
  a:hover {
    color: #e65c00;
  }
`;

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
          <a href={`mailto:${params.value}`} style={{ textDecoration: 'none', color: '#FF6600' }}>
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
          <a href={`tel:${params.value}`} style={{ textDecoration: 'none', color: '#FF6600' }}>
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
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => {/* TODO: Navigate to edit contact */}}
            sx={{ 
              backgroundColor: '#FF6600',
              color: 'white',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
            title="Edit Contact"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.contact_id)}
            sx={{ 
              backgroundColor: '#f44336',
              color: 'white',
              '&:hover': { backgroundColor: '#d32f2f' }
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
        backgroundColor: '#0066A1',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        backgroundImage: 'linear-gradient(135deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 50%, rgba(0, 0, 0, 0.05) 50%, rgba(0, 0, 0, 0.05) 75%, transparent 75%, transparent)',
        backgroundSize: '20px 20px'
      }}
    >
      {/* Apply Fiserv brand styling */}
      <style>{FiservStyles}</style>
      
      <Typography variant="h4" sx={{ color: '#FF6600', mb: 3, fontWeight: 'bold' }}>
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#FF6600',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FF6600',
                    },
                  },
                }}
              />
              {loading && searchTerm && (
                <LinearProgress sx={{ mt: 1, height: '2px', '& .MuiLinearProgress-bar': { backgroundColor: '#FF6600' } }} />
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={() => {/* TODO: Navigate to create contact */}}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' },
                    minWidth: '140px'
                  }}
                >
                  Add Contact
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleExportToExcel}
                  disabled={exportLoading}
                  startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  sx={{ 
                    borderColor: '#FF6600',
                    color: '#FF6600',
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '120px'
                  }}
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
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e0e0e0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                }}
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
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e0e0e0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                }}
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
                  sx={{
                    color: '#FF6600',
                    '&.Mui-checked': {
                      color: '#FF6600',
                    },
                  }}
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
                sx={{ 
                  borderColor: '#FF6600',
                  color: '#FF6600',
                  backgroundColor: 'rgba(255, 102, 0, 0.04)'
                }}
              />
              <Chip 
                label={`${contacts.length} total contacts`} 
                color="primary" 
                sx={{ 
                  backgroundColor: '#FF6600',
                  color: 'white'
                }}
              />
              {searchTerm && (
                <Chip 
                  label={`Search: "${searchTerm}"`} 
                  color="primary" 
                  onDelete={() => setSearchTerm('')}
                  sx={{ 
                    backgroundColor: '#0066A1',
                    color: 'white'
                  }}
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
              sx={{ borderColor: '#0066A1', color: '#0066A1' }}
            />
            <Chip 
              icon={<BusinessIcon />}
              label={`${contacts.filter(c => c.type === 'contractor').length} Contractors`} 
              variant="outlined"
              sx={{ borderColor: '#28a745', color: '#28a745' }}
            />
            <Chip 
              icon={<BusinessIcon />}
              label={`${contacts.filter(c => c.type === 'supplier').length} Suppliers`} 
              variant="outlined"
              sx={{ borderColor: '#17a2b8', color: '#17a2b8' }}
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
                <CircularProgress sx={{ color: '#FF6600' }} />
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
                  onClick={fetchContacts}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' }
                  }}
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
                    onClick={() => {/* TODO: Navigate to create contact */}}
                    startIcon={<AddIcon />}
                    sx={{ 
                      backgroundColor: '#FF6600',
                      '&:hover': { backgroundColor: '#e65c00' }
                    }}
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
                    color: '#0066A1',
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
                backgroundColor: '#4caf50',
                color: 'white',
                borderRadius: '0.75rem',
                mb: 1,
              }}
            >
              <Typography variant="body2">✅ {success}</Typography>
            </Paper>
          )}
          {error && (
            <Paper
              elevation={6}
              sx={{
                p: 2,
                backgroundColor: '#f44336',
                color: 'white',
                borderRadius: '0.75rem',
              }}
            >
              <Typography variant="body2">❌ {error}</Typography>
            </Paper>
          )}
        </Box>
      )}

    </Container>
  );
};

export default Contacts;
