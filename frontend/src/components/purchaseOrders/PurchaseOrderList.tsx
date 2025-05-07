import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchaseOrdersApi } from '../../services/api';
import { PurchaseOrder } from '../../types/purchaseOrder';
import { format } from 'date-fns';
import '../../styles/Dialog.css'; // Using the same styles as PartsUsageDialog
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import SimplePODocuments from './SimplePODocuments';

const PurchaseOrderList: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Add state for document dialog
  const [documentDialogOpen, setDocumentDialogOpen] = useState<boolean>(false);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>('');
  const navigate = useNavigate();

  // Add a derived state to check for pending POs
  const pendingPOsExist = purchaseOrders.some(po => 
    po.status === 'pending' || po.status === 'submitted'
  );

  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        setLoading(true);
        console.log('Fetching purchase orders...');
        const response = await purchaseOrdersApi.getAll();
        console.log('Purchase orders response:', response);
        setPurchaseOrders(response.data || []);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching purchase orders:', error);
        // More detailed error information
        const errorMessage = error.response ? 
          `Error ${error.response.status}: ${error.response.data}` : 
          error.message || 'Failed to load purchase orders';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseOrders();
  }, []);

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
      case 'on_hold':
        return 'status-badge status-info';
      case 'rejected':
        return 'status-badge status-danger';
      case 'received':
        return 'status-badge status-success';
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

  const handleExportAllToExcel = () => {
    if (purchaseOrders.length === 0) return;

    // Format header row
    const headers = [
      'PO Number', 
      'Supplier', 
      'Status',
      'Created Date', 
      'Total Amount',
      'Updated Date'
    ];
    
    // Format purchase orders data
    const poData = purchaseOrders.map(po => [
      po.po_number,
      po.supplier_name || po.vendor_name || 'N/A',
      po.status?.toUpperCase() || 'PENDING',
      po.created_at ? format(new Date(po.created_at), 'MM/dd/yyyy') : 'N/A',
      typeof po.total_amount === 'number' ? 
        po.total_amount.toFixed(2) : 
        Number(po.total_amount || 0).toFixed(2),
      po.updated_at ? format(new Date(po.updated_at), 'MM/dd/yyyy') : 'N/A'
    ]);
    
    // Combine all rows
    const csvRows = [
      headers,
      ...poData
    ];
    
    // Create CSV content
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `All_Purchase_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container-fluid p-0">
      <div style={{ 
        borderRadius: '4px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        background: 'white' 
      }}>
        <div style={{ 
          backgroundColor: '#0066A1',
          padding: '12px 20px',
          position: 'relative',
          minHeight: '60px'
        }}>
          <h5 style={{ 
            fontSize: '20px',
            margin: '0',
            color: '#ff6200',
            fontWeight: 'bold',
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}>
            Purchase Orders
          </h5>
          
          <div style={{ 
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: '8px'
          }}>
            <button 
              className="btn btn-sm btn-outline-light"
              onClick={() => navigate('/purchase-orders/suppliers')}
            >
              Manage Suppliers
            </button>
            <button 
              className="btn btn-sm"
              onClick={() => navigate('/purchase-orders/create-manual')}
              style={{ backgroundColor: '#ff6200', borderColor: '#ff6200', color: 'white' }}
            >
              Create Manual PO
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => navigate('/purchase-orders/create')}
            >
              Generate PO
            </button>
          </div>
        </div>

        <div style={{ padding: '15px 20px' }}>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-primary me-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span>Loading purchase orders...</span>
            </div>
          ) : error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center p-5">
              <p className="mb-2">No purchase orders found</p>
              <p className="text-muted mb-3">
                Use the "Create Manual PO" button to enter purchase order details manually.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th className="text-end">Total Amount</th>
                    <th>Created</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.po_id}>
                      <td>{po.po_number}</td>
                      <td>{po.supplier_name || po.vendor_name || 'N/A'}</td>
                      <td>
                        <span className={getStatusClass(po.status)}>
                          {po.status || 'pending'}
                        </span>
                      </td>
                      <td className="text-end">
                        ${typeof po.total_amount === 'number' ? po.total_amount.toFixed(2) : Number(po.total_amount || 0).toFixed(2)}
                      </td>
                      <td>
                        {po.created_at ? new Date(po.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button 
                            style={{ 
                              width: '30px', 
                              height: '20px', 
                              backgroundColor: '#ff6200', 
                              border: 'none', 
                              borderRadius: '30px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                            onClick={() => navigate(`/purchase-orders/detail/${po.po_id}`)}
                            title="View Details"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16">
                              <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                              <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                            </svg>
                          </button>
                          {/* Document Button */}
                          <button 
                            style={{ 
                              width: '30px', 
                              height: '20px', 
                              backgroundColor: '#0066A1', 
                              border: 'none', 
                              borderRadius: '30px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                            onClick={() => openDocumentDialog(po.po_id, po.po_number || '')}
                            title="View Documents"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 16 16">
                              <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm5.5 1.5v2a1 1 0 0 0 1 1h2l-3-3z"/>
                            </svg>
                          </button>
                          <button 
                            style={{ 
                              width: '30px', 
                              height: '20px', 
                              backgroundColor: '#ff4d4d', 
                              border: 'none', 
                              borderRadius: '30px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                            onClick={() => handleDelete(po.po_id)}
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Document Dialog */}
      <Dialog 
        open={documentDialogOpen} 
        onClose={closeDocumentDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <DescriptionIcon style={{ marginRight: '8px' }} />
              Documents for PO #{selectedPoNumber}
            </div>
            <IconButton onClick={closeDocumentDialog} size="small">
              <CloseIcon />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPoId && <SimplePODocuments poId={selectedPoId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrderList;
