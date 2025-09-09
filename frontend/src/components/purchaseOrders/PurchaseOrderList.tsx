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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
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
import { purchaseOrdersApi } from '../../services/api';
import { PurchaseOrder } from '../../types/purchaseOrder';
import { format } from 'date-fns';
import '../../styles/Dialog.css'; // Using the same styles as PartsUsageDialog
import SimplePODocuments from './SimplePODocuments';
import socket from '../../services/socket'; // Import socket for real-time updates

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

const PurchaseOrderList: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  // Add state for document dialog
  const [documentDialogOpen, setDocumentDialogOpen] = useState<boolean>(false);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>('');
  // Add state for showing historical received orders
  const [showHistoricalReceived, setShowHistoricalReceived] = useState<boolean>(false);
  const navigate = useNavigate();

  // Add a derived state to check for pending POs
  const pendingPOsExist = purchaseOrders.some(po => 
    po.status === 'pending' || po.status === 'submitted'
  );

  // Effect for filtering purchase orders based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOrders(purchaseOrders);
    } else {
      const filtered = purchaseOrders.filter(po =>
        po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOrders(filtered);
    }
  }, [purchaseOrders, searchTerm]);

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching purchase orders...');
      console.log('Show historical received:', showHistoricalReceived);
      const response = await purchaseOrdersApi.getAll(showHistoricalReceived);
      console.log('Purchase orders response:', response);
      
      let orders: PurchaseOrder[] = [];
      // Check if response.data.items exists and is an array
      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        orders = response.data.items;
      } else if (Array.isArray(response.data)) {
        // Fallback to direct response.data if it's an array
        orders = response.data;
      }
      
      setPurchaseOrders(orders);
      setFilteredOrders(orders);
    } catch (error: any) {
      console.error('Error fetching purchase orders:', error);
      // More detailed error information
      const errorMessage = error.response ? 
        `Error ${error.response.status}: ${error.response.data}` : 
        error.message || 'Failed to load purchase orders';
      setError(errorMessage);
      // Set empty array on error to prevent undefined
      setPurchaseOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }, [showHistoricalReceived]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

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

  // Add socket event listeners for real-time updates
  useEffect(() => {
    console.log('Setting up socket listeners for PurchaseOrderList');
    
    // Function to refresh purchase orders list
    const refreshPurchaseOrdersList = async () => {
      try {
        setIsRefreshing(true);
        console.log('Refreshing purchase orders list due to socket event');
        const response = await purchaseOrdersApi.getAll(showHistoricalReceived);
        
        let orders: PurchaseOrder[] = [];
        if (response.data && response.data.items && Array.isArray(response.data.items)) {
          orders = response.data.items;
        } else if (Array.isArray(response.data)) {
          orders = response.data;
        }
        
        setPurchaseOrders(orders);
        setFilteredOrders(orders);
      } catch (error) {
        console.error('Error refreshing purchase orders list:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    // Listen for purchase order updates (includes email approvals)
    socket.on('purchase_order_update', (data: any) => {
      console.log('PurchaseOrderList received purchase_order_update:', data);
      refreshPurchaseOrdersList();
    });

    // Listen for status changes
    socket.on('po_status_changed', (data: any) => {
      console.log('PurchaseOrderList received po_status_changed:', data);
      refreshPurchaseOrdersList();
    });

    // Listen for email status updates
    socket.on('email_status_update', (data: any) => {
      console.log('PurchaseOrderList received email_status_update:', data);
      refreshPurchaseOrdersList();
    });

    // Listen for dashboard updates
    socket.on('dashboard-update', (data: any) => {
      console.log('PurchaseOrderList received dashboard-update:', data);
      if (data.type === 'purchase_order_status_change' || data.type === 'purchase_order_refresh') {
        refreshPurchaseOrdersList();
      }
    });

    // Cleanup listeners on component unmount
    return () => {
      console.log('Cleaning up PurchaseOrderList socket listeners');
      socket.off('purchase_order_update');
      socket.off('po_status_changed');
      socket.off('email_status_update');
      socket.off('dashboard-update');
    };
  }, [showHistoricalReceived]); // Include showHistoricalReceived in dependency array

  // Add function to open document dialog
  const openDocumentDialog = (poId: number | undefined, poNumber: string | undefined) => {
    if (!poId) return;
    setSelectedPoId(poId);
    setSelectedPoNumber(poNumber || 'Unknown');
    setDocumentDialogOpen(true);
  };

  // Add function to close document dialog
  const closeDocumentDialog = () => {
    setDocumentDialogOpen(false);
    setSelectedPoId(null);
    setSelectedPoNumber('');
  };

  const getStatusClass = (status: string | undefined) => {
    switch (status) {
      case 'pending':
        return 'status-badge status-warning';
      case 'submitted':
        return 'status-badge status-info';
      case 'approved':
        return 'status-badge status-success';
      case 'waiting_for_po_number':
        return 'status-badge status-secondary';
      case 'on_hold':
        return 'status-badge status-secondary';
      case 'rejected':
        return 'status-badge status-danger';
      case 'received':
        return 'status-badge status-success';
      case 'on_order':
        return 'status-badge status-info';
      case 'canceled':
        return 'status-badge status-danger';
      default:
        return 'status-badge';
    }
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) {
      console.error('No PO ID provided for deletion');
      return;
    }
    
    console.log('Attempting to delete PO:', id);
    
    if (window.confirm('Are you sure you want to delete this purchase order?')) {
      try {
        setIsLoading(true);
        console.log('Making delete request to API...');
        
        // First attempt with increased timeout
        try {
          const response = await purchaseOrdersApi.delete(id);
          console.log('Delete response:', response);
          setPurchaseOrders(purchaseOrders.filter(po => po.po_id !== id));
          alert('Purchase order deleted successfully');
          return;
        } catch (error: any) {
          console.error('First delete attempt failed:', error);
          
          // If it's not a timeout error, rethrow
          if (!error.message?.includes('timed out')) {
            throw error;
          }
          
          // If we got a timeout, wait 2 seconds and verify if the PO still exists
          console.log('Delete timed out, verifying PO existence...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            // Try to fetch the PO
            const verifyResponse = await purchaseOrdersApi.getById(id);
            console.log('PO still exists after timeout:', verifyResponse);
            // If we get here, the PO still exists, so throw the original error
            throw error;
          } catch (verifyError: any) {
            console.log('Verification error:', verifyError);
            if (verifyError.response?.status === 404) {
              // PO doesn't exist anymore, so the delete was actually successful
              setPurchaseOrders(purchaseOrders.filter(po => po.po_id !== id));
              alert('Purchase order deleted successfully');
              return;
            }
            throw error; // Re-throw the original error
          }
        }
      } catch (error: any) {
        console.error('Error deleting purchase order:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response,
          status: error.response?.status,
          data: error.response?.data
        });
        
        let errorMessage = 'Failed to delete purchase order. Please try again later.';
        
        if (error.response?.status === 404) {
          errorMessage = 'Purchase order not found.';
        } else if (error.response?.status === 400) {
          errorMessage = error.response.data.message || 'Cannot delete this purchase order.';
        } else if (error.message.includes('timed out')) {
          errorMessage = 'Operation timed out. The purchase order may have been deleted. Please refresh the page.';
        }
        
        setError(errorMessage);
        alert(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExportAllToExcel = async () => {
    try {
      setExportLoading(true);
      
      // Use filtered orders for export
      const ordersToExport = filteredOrders;
      if (ordersToExport.length === 0) {
        setError('No purchase orders to export');
        return;
      }

      // Transform data for export
      const exportData = ordersToExport.map((po: PurchaseOrder) => ({
        'PO Number': po.po_number || '',
        'Supplier': po.supplier_name || po.vendor_name || 'N/A',
        'Status': po.status?.toUpperCase() || 'PENDING',
        'Created Date': po.created_at ? format(new Date(po.created_at), 'MM/dd/yyyy') : 'N/A',
        'Total Amount': typeof po.total_amount === 'number' ? 
          `$${po.total_amount.toFixed(2)}` : 
          `$${Number(po.total_amount || 0).toFixed(2)}`,
        'Updated Date': po.updated_at ? format(new Date(po.updated_at), 'MM/dd/yyyy') : 'N/A'
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // PO Number
        { wch: 30 }, // Supplier
        { wch: 15 }, // Status
        { wch: 15 }, // Created Date
        { wch: 15 }, // Total Amount
        { wch: 15 }, // Updated Date
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
      
      // Generate filename
      const filename = `purchase_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Purchase orders exported successfully!');
    } catch (error: any) {
      console.error('Error exporting purchase orders:', error);
      setError('Failed to export purchase orders');
    } finally {
      setExportLoading(false);
    }
  };

  // Define DataGrid columns
  const columns: GridColDef[] = [
    { field: 'po_number', headerName: 'PO Number', width: 150 },
    { 
      field: 'supplier_name', 
      headerName: 'Supplier', 
      flex: 1,
      renderCell: (params: GridRenderCellParams) => 
        params.row.supplier_name || params.row.vendor_name || 'N/A'
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const getStatusColor = (status: string) => {
          switch (status?.toLowerCase()) {
            case 'pending': return 'warning';
            case 'submitted': return 'info';
            case 'approved': return 'success';
            case 'rejected': return 'error';
            case 'received': return 'success';
            case 'on_order': return 'info';
            case 'canceled': return 'error';
            default: return 'default';
          }
        };
        
        return (
          <Chip 
            label={params.value || 'pending'} 
            size="small"
            color={getStatusColor(params.value) as any}
            variant="outlined"
          />
        );
      }
    },
    { 
      field: 'total_amount', 
      headerName: 'Total Amount', 
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <span>${typeof params.value === 'number' ? params.value.toFixed(2) : Number(params.value || 0).toFixed(2)}</span>
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => 
        params.value ? new Date(params.value).toLocaleDateString() : 'N/A'
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
            onClick={() => navigate(`/purchase-orders/detail/${params.row.po_id}`)}
            sx={{ 
              backgroundColor: '#FF6600',
              color: 'white',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => openDocumentDialog(params.row.po_id, params.row.po_number || '')}
            sx={{ 
              backgroundColor: '#0066A1',
              color: 'white',
              '&:hover': { backgroundColor: '#004d7a' }
            }}
            title="View Documents"
          >
            <DescriptionIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.po_id)}
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
        Purchase Orders Management
        {isRefreshing && (
          <CircularProgress 
            size={24} 
            sx={{ ml: 2, color: '#FF6600' }} 
            title="Refreshing purchase orders..." 
          />
        )}
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Actions */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by PO number, supplier, or status..."
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
                  onClick={() => navigate('/purchase-orders/create')}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' },
                    minWidth: '140px'
                  }}
                >
                  Generate PO
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/purchase-orders/create-manual')}
                  startIcon={<AddIcon />}
                  sx={{ 
                    borderColor: '#FF6600',
                    color: '#FF6600',
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '140px'
                  }}
                >
                  Manual PO
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/purchase-orders/suppliers')}
                  startIcon={<BusinessIcon />}
                  sx={{ 
                    borderColor: '#FF6600',
                    color: '#FF6600',
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '140px'
                  }}
                >
                  Suppliers
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleExportAllToExcel}
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

          {/* Options and Statistics */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showHistoricalReceived}
                  onChange={(e) => setShowHistoricalReceived(e.target.checked)}
                  sx={{
                    color: '#FF6600',
                    '&.Mui-checked': {
                      color: '#FF6600',
                    },
                  }}
                />
              }
              label="Show historical received orders"
              sx={{ 
                '& .MuiFormControlLabel-label': { 
                  fontSize: '0.875rem',
                  color: '#666'
                }
              }}
            />
            
            <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
              <Chip 
                label={`${filteredOrders.length} orders showing`} 
                color="primary" 
                variant="outlined"
                sx={{ 
                  borderColor: '#FF6600',
                  color: '#FF6600',
                  backgroundColor: 'rgba(255, 102, 0, 0.04)'
                }}
              />
              <Chip 
                label={`${purchaseOrders.length} total orders`} 
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

          {/* Info message for historical orders */}
          {!showHistoricalReceived && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'rgba(255, 193, 7, 0.1)', 
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 193, 7, 0.3)'
            }}>
              <Typography variant="body2" sx={{ color: '#856404' }}>
                <strong>ℹ️ Info:</strong> Received purchase orders older than 7 days are hidden. 
                Use the checkbox above to view them.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Purchase Orders Table */}
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
                <Typography variant="body1" sx={{ mt: 2 }}>Loading purchase orders...</Typography>
              </Box>
            ) : error ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="error" gutterBottom>
                  Error Loading Purchase Orders
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {error}
                </Typography>
                <Button
                  variant="contained"
                  onClick={fetchPurchaseOrders}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' }
                  }}
                >
                  Retry
                </Button>
              </Box>
            ) : filteredOrders.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No orders match your search' : 'No purchase orders found'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 
                    'Try adjusting your search terms or clear the search to see all orders.' :
                    'Use the "Generate PO" or "Manual PO" buttons to create purchase orders.'}
                </Typography>
                {!searchTerm && (
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      onClick={() => navigate('/purchase-orders/create')}
                      startIcon={<AddIcon />}
                      sx={{ 
                        backgroundColor: '#FF6600',
                        '&:hover': { backgroundColor: '#e65c00' }
                      }}
                    >
                      Generate PO
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/purchase-orders/create-manual')}
                      startIcon={<AddIcon />}
                      sx={{ 
                        borderColor: '#FF6600',
                        color: '#FF6600',
                        '&:hover': { 
                          borderColor: '#e65c00',
                          backgroundColor: 'rgba(255, 102, 0, 0.04)'
                        }
                      }}
                    >
                      Manual PO
                    </Button>
                  </Box>
                )}
              </Box>
            ) : (
              <StyledDataGrid
                columns={columns}
                rows={filteredOrders}
                getRowId={(row) => row.po_id}
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

      {/* Document Dialog */}
      <Dialog 
        open={documentDialogOpen} 
        onClose={closeDocumentDialog}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '0.75rem'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#0066A1', 
          color: 'white',
          borderRadius: '0.75rem 0.75rem 0 0'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DescriptionIcon sx={{ mr: 1, color: '#FF6600' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>
                Documents for PO #{selectedPoNumber}
              </Typography>
            </Box>
            <IconButton 
              onClick={closeDocumentDialog} 
              size="small"
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {selectedPoId && <SimplePODocuments poId={selectedPoId} />}
        </DialogContent>
      </Dialog>

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

export default PurchaseOrderList;
