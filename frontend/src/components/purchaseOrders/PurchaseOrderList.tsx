import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRIMARY_ORANGE } from '../../theme';
import {
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
  Upload as UploadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import CloseIcon from '@mui/icons-material/Close';
import { purchaseOrdersApi } from '../../services/api';
import { PurchaseOrder } from '../../types/purchaseOrder';
import { format } from 'date-fns';
import SimplePODocuments from './SimplePODocuments';
import POImportDialog from './POImportDialog';
import socket from '../../services/socket'; // Import socket for real-time updates
import DataTable, { ColumnDef } from '../DataTable';

type PoRow = PurchaseOrder & { id: number };

const PurchaseOrderList: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Server-reported total for the current filter (may exceed the rows loaded)
  const [totalCount, setTotalCount] = useState<number>(0);
  const [exportLoading, setExportLoading] = useState(false);
  // Add state for document dialog
  const [documentDialogOpen, setDocumentDialogOpen] = useState<boolean>(false);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>('');
  // Add state for showing historical received orders
  const [showHistoricalReceived, setShowHistoricalReceived] = useState<boolean>(false);
  // Add state for PDF import dialog
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  // Add a derived state to check for pending POs
  const pendingPOsExist = purchaseOrders.some(po => 
    po.status === 'pending' || po.status === 'submitted'
  );

  // Effect for filtering purchase orders based on search term - use server-side search
  useEffect(() => {
    // Always show all fetched orders since server-side filtering is now used
    setFilteredOrders(purchaseOrders);
  }, [purchaseOrders]);

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching purchase orders...');
      console.log('Show historical received:', showHistoricalReceived);
      console.log('Search term:', searchTerm);
      const response = await purchaseOrdersApi.getAll(showHistoricalReceived, searchTerm);
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
      setTotalCount(response.data?.total ?? orders.length);
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

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm) {
        // Perform search-specific fetch
        try {
          setLoading(true);
          setError(null);
          console.log('Performing search for:', searchTerm);
          const response = await purchaseOrdersApi.getAll(showHistoricalReceived, searchTerm);
          console.log('Search response:', response);
          
          let orders: PurchaseOrder[] = [];
          if (response.data && response.data.items && Array.isArray(response.data.items)) {
            orders = response.data.items;
          } else if (Array.isArray(response.data)) {
            orders = response.data;
          }
          
          setPurchaseOrders(orders);
          setFilteredOrders(orders);
          setTotalCount(response.data?.total ?? orders.length);
        } catch (error: any) {
          console.error('Error searching purchase orders:', error);
          setError('Failed to search purchase orders');
          setPurchaseOrders([]);
          setFilteredOrders([]);
        } finally {
          setLoading(false);
        }
      } else {
        // If search term is empty, fetch all orders
        fetchPurchaseOrders();
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [searchTerm, showHistoricalReceived, fetchPurchaseOrders]);

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
        setTotalCount(response.data?.total ?? orders.length);
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

  const getStatusColor = (status?: string) => {
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

  // Define DataTable columns
  const columns: ColumnDef<PoRow>[] = [
    { key: 'po_number', label: 'PO Number' },
    {
      key: 'supplier_name',
      label: 'Supplier',
      render: (row) => row.supplier_name || row.vendor_name || 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Chip
          label={row.status || 'pending'}
          size="small"
          color={getStatusColor(row.status) as any}
          variant="outlined"
        />
      ),
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      align: 'right',
      render: (row) => (
        <span>${typeof row.total_amount === 'number' ? row.total_amount.toFixed(2) : Number(row.total_amount || 0).toFixed(2)}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'),
    },
    {
      key: 'po_id',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/detail/${row.po_id}`); }}
            sx={{
              backgroundColor: PRIMARY_ORANGE,
              color: 'white',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); openDocumentDialog(row.po_id, row.po_number || ''); }}
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
            onClick={(e) => { e.stopPropagation(); handleDelete(row.po_id); }}
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
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 6, height: 40, bgcolor: PRIMARY_ORANGE, borderRadius: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Purchase Orders Management
        </Typography>
        {isRefreshing && (
          <CircularProgress
            size={24}
            sx={{ ml: 2, color: PRIMARY_ORANGE }}
            title="Refreshing purchase orders..."
          />
        )}
      </Box>
      
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
                      borderColor: PRIMARY_ORANGE,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                  },
                }}
              />
              {loading && searchTerm && (
                <LinearProgress sx={{ mt: 1, height: '2px', '& .MuiLinearProgress-bar': { backgroundColor: PRIMARY_ORANGE } }} />
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/purchase-orders/create')}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: PRIMARY_ORANGE, 
                    borderColor: PRIMARY_ORANGE,
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
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
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
                  onClick={() => setImportDialogOpen(true)}
                  startIcon={<UploadIcon />}
                  sx={{ 
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '140px'
                  }}
                >
                  Import PDF
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/purchase-orders/suppliers')}
                  startIcon={<BusinessIcon />}
                  sx={{ 
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
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
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
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
                    color: PRIMARY_ORANGE,
                    '&.Mui-checked': {
                      color: PRIMARY_ORANGE,
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
                  borderColor: PRIMARY_ORANGE,
                  color: PRIMARY_ORANGE,
                  backgroundColor: 'rgba(255, 102, 0, 0.04)'
                }}
              />
              <Chip
                label={`${totalCount} total orders`}
                color="primary" 
                sx={{ 
                  backgroundColor: PRIMARY_ORANGE,
                  color: 'white'
                }}
              />
              {searchTerm && (
                <Chip 
                  label={`Search: "${searchTerm}"`} 
                  color="primary" 
                  onDelete={() => setSearchTerm('')}
                  sx={{
                    backgroundColor: PRIMARY_ORANGE,
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
                <CircularProgress sx={{ color: PRIMARY_ORANGE }} />
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
                    backgroundColor: PRIMARY_ORANGE,
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
                        backgroundColor: PRIMARY_ORANGE,
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
                        borderColor: PRIMARY_ORANGE,
                        color: PRIMARY_ORANGE,
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
              <DataTable<PoRow>
                columns={columns}
                rows={filteredOrders.map((po) => ({ ...po, id: po.po_id ?? 0 })) as PoRow[]}
                pageSize={25}
                emptyMessage="No purchase orders found"
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
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DescriptionIcon sx={{ mr: 1, color: PRIMARY_ORANGE }} />
              <Typography variant="h6">
                Documents for PO #{selectedPoNumber}
              </Typography>
            </Box>
            <IconButton
              onClick={closeDocumentDialog}
              size="small"
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

      {/* PDF Import Dialog */}
      <POImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => {
          setImportDialogOpen(false);
          fetchPurchaseOrders();
        }}
      />

    </Box>
  );
};

export default PurchaseOrderList;
