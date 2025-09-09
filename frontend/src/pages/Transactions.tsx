import React, { useEffect, useState, useCallback } from 'react';
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
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { 
  DataGrid, 
  GridColDef, 
  GridRenderCellParams,
  GridPaginationModel,
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import axios from 'axios';

interface Transaction {
  transaction_id: number;
  part_id: number;
  part_name: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_name: string;
  type: string;
  quantity: number;
  date: string;
  user_id: string;
  notes: string;
  reference_number: string;
  unit_cost: number;
}

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

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const fetchTransactions = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (start) params.append('startDate', `${start}T00:00:00`);
      if (end) params.append('endDate', `${end}T23:59:59`);

      const response = await axios.get<Transaction[]>(`/api/v1/transactions?${params.toString()}`);
      console.log('Transactions:', response.data);
      setTransactions(response.data);
      setFilteredTransactions(response.data);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect for filtering transactions based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredTransactions(transactions);
    } else {
      const filtered = transactions.filter(transaction =>
        transaction.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.fiserv_part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.manufacturer_part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.machine_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTransactions(filtered);
    }
  }, [transactions, searchTerm]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    fetchTransactions();
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Use filtered transactions for export
      const transactionsToExport = filteredTransactions;

      // Transform data for export
      const exportData = transactionsToExport.map((transaction: Transaction) => ({
        'Date': formatDate(transaction.date),
        'Part Name': transaction.part_name,
        'Fiserv Part #': transaction.fiserv_part_number,
        'Manufacturer Part #': transaction.manufacturer_part_number || '',
        'Machine': transaction.machine_name || 'N/A',
        'Quantity': transaction.quantity,
        'Unit Cost': transaction.unit_cost ? `$${Number(transaction.unit_cost).toFixed(2)}` : '$0.00'
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Date
        { wch: 35 }, // Part Name
        { wch: 25 }, // Fiserv Part #
        { wch: 30 }, // Manufacturer Part #
        { wch: 25 }, // Machine
        { wch: 12 }, // Quantity
        { wch: 15 }, // Unit Cost
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      // Generate filename
      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      const filename = `transactions${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Transactions exported successfully!');
    } catch (error: any) {
      console.error('Error exporting transactions:', error);
      setError('Failed to export transactions');
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
    }
  };

  // Define DataGrid columns
  const columns: GridColDef[] = [
    { 
      field: 'date', 
      headerName: 'Date', 
      width: 180,
      renderCell: (params: GridRenderCellParams) => formatDateShort(params.value)
    },
    { field: 'part_name', headerName: 'Part Name', flex: 2 },
    { field: 'fiserv_part_number', headerName: 'Fiserv Part #', flex: 1.2 },
    { field: 'manufacturer_part_number', headerName: 'Mfg Part #', flex: 1.2 },
    { field: 'machine_name', headerName: 'Machine', flex: 1.5 },
    { 
      field: 'quantity', 
      headerName: 'Quantity', 
      type: 'number', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ 
          fontWeight: 'bold',
          color: params.row.type === 'checkout' ? '#f44336' : '#4caf50'
        }}>
          {params.row.type === 'checkout' ? '-' : '+'}{params.value}
        </Box>
      )
    },
    { 
      field: 'unit_cost', 
      headerName: 'Unit Cost', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <span>${Number(params.value || 0).toFixed(2)}</span>
      )
    },
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
        Parts Usage History
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Filters */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="end">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search transactions by part name, part number, or machine..."
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
            
            <Grid item xs={6} md={2}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" />
                    </InputAdornment>
                  ),
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
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" />
                    </InputAdornment>
                  ),
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
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleFilter}
                  startIcon={<FilterListIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' },
                    minWidth: '100px'
                  }}
                >
              Filter
            </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    borderColor: '#FF6600',
                    color: '#FF6600',
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '100px'
                  }}
                >
              Reset
            </Button>
                <Button
                  variant="outlined"
                  onClick={handleExport}
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

          {/* Statistics row */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Chip 
              label={`${filteredTransactions.length} transactions showing`} 
              color="primary" 
              variant="outlined"
              sx={{ 
                borderColor: '#FF6600',
                color: '#FF6600',
                backgroundColor: 'rgba(255, 102, 0, 0.04)'
              }}
            />
            <Chip 
              label={`${transactions.length} total transactions`} 
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
            {(startDate || endDate) && (
              <Chip 
                label={`Date Filter: ${startDate || 'Start'} to ${endDate || 'End'}`} 
                color="primary" 
                onDelete={() => {
                  setStartDate('');
                  setEndDate('');
                  fetchTransactions();
                }}
                sx={{ 
                  backgroundColor: '#0066A1',
                  color: 'white'
                }}
              />
            )}
          </Box>
        </Paper>

        {/* Transactions Table */}
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
                <Typography variant="body1" sx={{ mt: 2 }}>Loading transactions...</Typography>
              </Box>
            ) : (
              <StyledDataGrid
                columns={columns}
                rows={filteredTransactions}
                getRowId={(row) => row.transaction_id}
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

      {/* Success/Error Notifications */}
      {(!!error || !!success) && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1400,
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 2,
              borderRadius: '0.75rem',
              backgroundColor: error ? '#f44336' : '#4caf50',
              color: 'white',
              minWidth: '300px',
              maxWidth: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2">
              {error || success}
            </Typography>
            <IconButton
              size="small"
              onClick={() => { setError(null); setSuccess(null); }}
              sx={{ color: 'white', ml: 1 }}
            >
              ✕
            </IconButton>
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default Transactions;
