import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  IconButton,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  FormControlLabel,
  Checkbox,
  Switch
} from '@mui/material';
import { format } from 'date-fns';
import { purchaseOrdersApi } from '../../services/api';
import { PurchaseOrder } from '../../types/purchaseOrder';
import { 
  ArrowBack, 
  PictureAsPdf, 
  Description, 
  Email, 
  Phone, 
  Person, 
  LocationOn, 
  Edit, 
  Check, 
  Close,
  Send,
  ExpandLess,
  ExpandMore,
  History,
  Refresh,
  Notifications,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { generatePurchaseOrderPDF } from '../../utils/pdfTemplates';
import { generatePurchaseOrderExcel } from '../../utils/excelTemplates';
import socket from '../../services/socket'; // Import the socket service
import { partsApi } from '../../services/api';
import { Part } from '../../types/purchaseOrder';
import { Autocomplete } from '@mui/material';
import axios from 'axios';
import ModalPortal from '../ModalPortal';

// Define interface for email tracking records
interface EmailTrackingRecord {
  id: number;
  po_id: number;
  tracking_code: string;
  recipient_email: string;
  email_subject: string;
  status: 'pending' | 'approved' | 'on_hold' | 'rejected';
  sent_date: string;
  approval_date?: string;
  approval_email?: string;
  notes?: string;
}

// Define socket event interface
interface EmailStatusUpdateEvent {
  po_id: number;
  status: 'approved' | 'on_hold' | 'rejected';
  trackingCode: string;
  notes?: string;
}

const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [nextDayAir, setNextDayAir] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [isEditingPoNumber, setIsEditingPoNumber] = useState<boolean>(false);
  const [editedPoNumber, setEditedPoNumber] = useState<string>('');
  const [requestedBy, setRequestedBy] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('');
  const [isEditingRequestedBy, setIsEditingRequestedBy] = useState<boolean>(false);
  const [isEditingApprovedBy, setIsEditingApprovedBy] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [emailDialogOpen, setEmailDialogOpen] = useState<boolean>(false);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [emailDialogError, setEmailDialogError] = useState<string>('');
  const [emailNotes, setEmailNotes] = useState<string>(''); // New state for email notes
  const [emailHistory, setEmailHistory] = useState<EmailTrackingRecord[]>([]);
  const [showEmailHistory, setShowEmailHistory] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [newEmailUpdate, setNewEmailUpdate] = useState<boolean>(false); // Flag for new updates
  // Add new state for part management
  const [addPartDialogOpen, setAddPartDialogOpen] = useState<boolean>(false);
  const [partToAdd, setPartToAdd] = useState<any>(null);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [partSearchTerm, setPartSearchTerm] = useState<string>('');
  const [loadingParts, setLoadingParts] = useState<boolean>(false);
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isCustomPart, setIsCustomPart] = useState<boolean>(false);
  const [customPartName, setCustomPartName] = useState<string>('');
  const [customPartNumber, setCustomPartNumber] = useState<string>('');
  const navigate = useNavigate();

  // Define fetchPurchaseOrder function outside useEffect
  const fetchPurchaseOrder = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await purchaseOrdersApi.getById(parseInt(id));
      console.log('Purchase order data from API:', response.data);
      
      // Enhanced logging for debugging
      console.log('Purchase order structure:', JSON.stringify(response.data, null, 2));
      console.log('Supplier address check:', 
        response.data.supplier_address || 
        response.data.vendor_address || 
        response.data.address);
      
      // Create a normalized version of the purchase order with consistent field names
      const normalizedPO = {
        ...response.data,
        // Ensure we have consistent field names for address, email, phone
        supplier_address: response.data.supplier_address || response.data.address || '',
        supplier_email: response.data.supplier_email || response.data.email || '',
        supplier_phone: response.data.supplier_phone || response.data.phone || '',
        contact_name: response.data.contact_name || '',
        is_urgent: response.data.is_urgent || response.data.priority === 'urgent' || false,
        next_day_air: response.data.next_day_air || false
      };
      
      // Log each item in the purchase order
      if (response.data.items && response.data.items.length > 0) {
        console.log(`Found ${response.data.items.length} items in purchase order:`);
        response.data.items.forEach((item: any, index: number) => {
          console.log(`Item ${index + 1}:`, JSON.stringify(item, null, 2));
        });
      } else {
        console.warn('No items found in purchase order');
      }
      
      setPurchaseOrder(normalizedPO);
      setStatus(normalizedPO.status || 'pending');
      setIsUrgent(normalizedPO.is_urgent || false);
      setNextDayAir(normalizedPO.next_day_air || false);
      setShippingCost(normalizedPO.shipping_cost || 0);
      setTaxAmount(normalizedPO.tax_amount || 0);
      setRequestedBy(normalizedPO.requested_by || '');
      setApprovedBy(normalizedPO.approved_by || '');
      setError(null);
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      setError('Failed to load purchase order. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrder();
  }, [id]);

  // Add new useEffect for socket.io listener
  useEffect(() => {
    if (!id) return;
    
    console.log('Setting up socket listeners for PO:', id);
    
    // Function to fetch purchase order data
    const fetchPo = async () => {
      try {
        console.log('Fetching updated PO data...');
        setLoading(true);
        const fetchedPo = await purchaseOrdersApi.getById(parseInt(id as string));
        console.log('Fetched PO data:', fetchedPo.data);
        setPurchaseOrder(fetchedPo.data);
        setStatus(fetchedPo.data.status);
        setIsUrgent(fetchedPo.data.is_urgent);
        setNextDayAir(fetchedPo.data.next_day_air);
        setShippingCost(fetchedPo.data.shipping_cost || 0);
        setTaxAmount(fetchedPo.data.tax_amount || 0);
        setRequestedBy(fetchedPo.data.requested_by || '');
        setApprovedBy(fetchedPo.data.approved_by || '');
        setError(null);
      } catch (error) {
        console.error('Error fetching purchase order:', error);
        setError('Failed to load purchase order. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    // Listen for email status updates
    socket.on('email_status_update', (data: EmailStatusUpdateEvent) => {
      console.log('Received email status update:', data);
      
      // Only process updates for this PO
      if (data.po_id === parseInt(id as string)) {
        console.log('Processing email status update for this PO');
        // Show notification
        setSnackbarMessage(`Email status updated to: ${data.status}${data.notes ? ' - ' + data.notes : ''}`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        
        // Flag that we have a new update
        setNewEmailUpdate(true);
        
        // Automatically refresh the email history
        refreshEmailHistory();
        
        // If this affects the PO status, refresh the whole PO data
        if (data.status === 'approved' || data.status === 'on_hold' || data.status === 'rejected') {
          console.log('Status change detected, refreshing PO data');
          fetchPo();
        }
      }
    });

    // Listen for purchase order updates
    socket.on('purchase_order_update', (data: any) => {
      console.log('Received purchase order update:', data);
      
      // Only process updates for this PO
      if (data.po_id === parseInt(id as string)) {
        console.log('Processing PO update for this PO');
        // Refresh the PO data
        fetchPo();
      }
    });
    
    // Cleanup listeners on component unmount
    return () => {
      console.log('Cleaning up socket listeners');
      socket.off('email_status_update');
      socket.off('purchase_order_update');
    };
  }, [id]);

  // Add new useEffect for fetching email history
  useEffect(() => {
    const fetchEmailHistory = async () => {
      if (!id) return;
      
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/v1/email/history/${id}`);
        const data = await response.json();
        
        if (data.success) {
          setEmailHistory(data.data);
        }
      } catch (error) {
        console.error('Error fetching email history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchEmailHistory();
  }, [id]);

  // Modify the refresh function to clear the new update flag
  const refreshEmailHistory = async () => {
    if (!id) return;
    
    try {
      setLoadingHistory(true);
      // Add cache-busting query parameter with timestamp
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/v1/email/history/${id}?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEmailHistory(data.data);
        
        // Clear the new update flag when we've refreshed
        if (newEmailUpdate) {
          setNewEmailUpdate(false);
        }
      }
    } catch (error) {
      console.error('Error refreshing email history:', error);
      setSnackbarMessage('Failed to refresh email history');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Add new useEffect for auto-refreshing email history
  useEffect(() => {
    let autoRefreshInterval: NodeJS.Timeout | null = null;
    
    // Only set up auto-refresh when email history is shown
    if (showEmailHistory && id) {
      console.log('Starting auto-refresh for email history');
      // Refresh email history every 10 seconds
      autoRefreshInterval = setInterval(() => {
        console.log('Auto-refreshing email history');
        refreshEmailHistory();
      }, 10000);
    }
    
    // Clean up interval on component unmount or when history is hidden
    return () => {
      if (autoRefreshInterval) {
        console.log('Stopping auto-refresh for email history');
        clearInterval(autoRefreshInterval);
      }
    };
  }, [showEmailHistory, id]);

  const handleStatusChange = async (event: React.ChangeEvent<{ value: unknown }>) => {
    const newStatus = event.target.value as string;
    
    if (!id || !purchaseOrder) return;
    
    try {
      setStatusUpdating(true);
      await purchaseOrdersApi.updateStatus(parseInt(id), newStatus);
      
      // Update local state
      setStatus(newStatus);
      setPurchaseOrder({
        ...purchaseOrder,
        status: newStatus as any
      });
      
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update purchase order status. Please try again later.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handlePriorityChange = async (urgent: boolean) => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create a priority update object
      const updateData = {
        po_id: parseInt(id),
        is_urgent: urgent,
        priority: urgent ? 'urgent' : 'normal'
      };
      
      // API call to update priority
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setIsUrgent(urgent);
      setPurchaseOrder({
        ...purchaseOrder,
        is_urgent: urgent,
        priority: urgent ? 'urgent' : 'normal'
      });
      
      console.log(`Priority updated to: ${urgent ? 'Urgent' : 'Not Urgent'}`);
      
    } catch (error) {
      console.error('Error updating priority:', error);
      setError('Failed to update purchase order priority. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleShippingChange = async (nextDay: boolean) => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create a shipping update object
      const updateData = {
        po_id: parseInt(id),
        next_day_air: nextDay
      };
      
      // API call to update shipping method
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setNextDayAir(nextDay);
      setPurchaseOrder({
        ...purchaseOrder,
        next_day_air: nextDay
      });
      
      console.log(`Shipping method updated to: ${nextDay ? 'Next Day Air' : 'Regular Shipping'}`);
      
    } catch (error) {
      console.error('Error updating shipping method:', error);
      setError('Failed to update shipping method. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShippingCostChange = async (value: number) => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create a shipping cost update object
      const updateData = {
        shipping_cost: value
      };
      
      // API call to update shipping cost
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setShippingCost(value);
      setPurchaseOrder({
        ...purchaseOrder,
        shipping_cost: value
      });
      
      console.log('Shipping cost updated successfully');
    } catch (error) {
      console.error('Error updating shipping cost:', error);
      setError('Failed to update shipping cost. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleTaxAmountChange = async (value: number) => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create a tax amount update object
      const updateData = {
        tax_amount: value
      };
      
      // API call to update tax amount
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setTaxAmount(value);
      setPurchaseOrder({
        ...purchaseOrder,
        tax_amount: value
      });
      
      console.log('Tax amount updated successfully');
    } catch (error) {
      console.error('Error updating tax amount:', error);
      setError('Failed to update tax amount. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportToPDF = async () => {
    if (!purchaseOrder) return;
    
    try {
      setLoading(true);
      console.log('Exporting purchase order to PDF - Full data:', JSON.stringify(purchaseOrder, null, 2));
      
      // Generate PDF with purchase order data
      await generatePurchaseOrderPDF(purchaseOrder);
      
    } catch (error) {
      console.error('Error generating PDF file:', error);
      setError('Failed to generate PDF. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!purchaseOrder) return;
    
    try {
      // Use the existing utility function to generate Excel
      await generatePurchaseOrderExcel(purchaseOrder);
      console.log('Excel export successful');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError('Failed to export purchase order to Excel. Please try again later.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'submitted':
        return 'info';
      case 'approved':
        return 'success';
      case 'on_hold':
        return 'info';
      case 'rejected':
        return 'error';
      case 'received':
        return 'success';
      case 'canceled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Handle PO Number Edit
  const handleEditPoNumber = () => {
    setEditedPoNumber(purchaseOrder?.po_number || '');
    setIsEditingPoNumber(true);
  };

  const handleSavePoNumber = async () => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create an update object for PO number
      const updateData = {
        po_number: editedPoNumber
      };
      
      // API call to update PO number
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setPurchaseOrder({
        ...purchaseOrder,
        po_number: editedPoNumber
      });
      
      console.log('PO number updated successfully');
      setIsEditingPoNumber(false);
    } catch (error) {
      console.error('Error updating PO number:', error);
      setError('Failed to update PO number. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelPoNumberEdit = () => {
    setIsEditingPoNumber(false);
  };

  const handlePoNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedPoNumber(e.target.value);
  };

  const handleSaveRequestedBy = async () => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create an update object
      const updateData = {
        requested_by: requestedBy
      };
      
      // API call to update
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setPurchaseOrder({
        ...purchaseOrder,
        requested_by: requestedBy
      });
      
      setIsEditingRequestedBy(false);
      console.log('Requested By updated successfully');
    } catch (error) {
      console.error('Error updating Requested By:', error);
      setError('Failed to update Requested By. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveApprovedBy = async () => {
    if (!id || !purchaseOrder) return;
    
    try {
      setIsUpdating(true);
      
      // Create an update object
      const updateData = {
        approved_by: approvedBy
      };
      
      // API call to update
      await purchaseOrdersApi.update(parseInt(id), updateData);
      
      // Update local state
      setPurchaseOrder({
        ...purchaseOrder,
        approved_by: approvedBy
      });
      
      setIsEditingApprovedBy(false);
      console.log('Approved By updated successfully');
    } catch (error) {
      console.error('Error updating Approved By:', error);
      setError('Failed to update Approved By. Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEmailDialog = () => {
    // Leave email field blank instead of pre-populating with supplier email
    setRecipientEmail('');
    setEmailNotes(''); // Reset notes when opening dialog
    setEmailDialogError('');
    setEmailDialogOpen(true);
  };

  const closeEmailDialog = () => {
    setEmailDialogOpen(false);
  };

  const handleSendEmail = async () => {
    // Validate email
    if (!recipientEmail || !recipientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailDialogError('Please enter a valid email address');
      return;
    }
    
    closeEmailDialog();
    
    if (!purchaseOrder) return;
    
    try {
      setLoading(true);
      
      // Generate PDF blob
      const pdfBlob = await generatePurchaseOrderPDF(purchaseOrder, true);
      
      // Check if pdfBlob exists before proceeding
      if (!pdfBlob) {
        throw new Error('Failed to generate PDF');
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result?.toString().split(',')[1];
          
          if (!base64data) {
            throw new Error('Failed to convert PDF to base64');
          }
          
          // Send to backend
          const response = await fetch('/api/v1/email/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pdfBase64: base64data,
              recipient: recipientEmail,
              poNumber: purchaseOrder.po_number,
              poId: purchaseOrder.po_id,
              notes: emailNotes
            }),
          });
          
          // Store the response text first before attempting to parse it
          const responseText = await response.text();
          console.log('Raw response:', responseText);
          
          let result;
          try {
            // Now parse the stored text as JSON
            result = JSON.parse(responseText);
          } catch (err) {
            console.error('Failed to parse response as JSON:', err);
            console.error('Response text:', responseText);
            throw new Error('Server returned invalid JSON response');
          }
          
          if (response.ok) {
            setSnackbarMessage('Purchase order PDF sent successfully');
            setSnackbarSeverity('success');
          } else {
            console.error('Server responded with error:', result);
            throw new Error(result.error || 'Failed to send email');
          }
        } catch (error: unknown) {
          console.error('Error in email sending process:', error);
          let errorMessage = 'Unknown error';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          setSnackbarMessage(`Failed to send email: ${errorMessage}`);
          setSnackbarSeverity('error');
        } finally {
          setLoading(false);
          setSnackbarOpen(true);
        }
      };
      
      reader.onerror = () => {
        setLoading(false);
        setSnackbarMessage('Failed to read PDF data');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        console.error('Error reading file');
      };
      
    } catch (error: unknown) {
      console.error('Error parsing response:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setSnackbarMessage(`Failed to send email: ${errorMessage}`);
      setSnackbarSeverity('error');
      setLoading(false);
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Modify the fetchAvailableParts function to handle errors better and log results
  const fetchAvailableParts = async () => {
    try {
      setLoadingParts(true);
      
      try {
        // Add more detailed logging of the exact response structure
        console.log('Fetching parts with getAll()');
        const response = await partsApi.getAll();
        console.log('Parts API response structure:', {
          hasData: !!response.data,
          dataType: typeof response.data,
          isArray: Array.isArray(response.data),
          responseKeys: Object.keys(response),
          firstItem: response.data && response.data.length > 0 ? response.data[0] : null,
          itemsProperty: response.data?.items ? 'Has items property' : 'No items property'
        });
        
        // Check if the data is inside a nested 'items' property like in PartsUsageDialog
        if (response.data && response.data.items && Array.isArray(response.data.items)) {
          console.log('Found parts in response.data.items:', response.data.items.length);
          setAvailableParts(response.data.items);
        } 
        // Check if data is directly an array
        else if (Array.isArray(response.data)) {
          console.log('Found parts in response.data array:', response.data.length);
          setAvailableParts(response.data);
        } 
        // If neither, try direct axios call like PartsUsageDialog does
        else {
          console.log('Trying direct axios approach like PartsUsageDialog');
          const directResponse = await axios.get('/api/v1/parts');
          console.log('Direct axios response:', directResponse);
          
          if (directResponse.data && Array.isArray(directResponse.data)) {
            console.log('Found parts in direct response:', directResponse.data.length);
            setAvailableParts(directResponse.data);
          } else if (directResponse.data && directResponse.data.items && Array.isArray(directResponse.data.items)) {
            console.log('Found parts in direct response.items:', directResponse.data.items.length);
            setAvailableParts(directResponse.data.items);
          } else {
            console.warn('No parts found in any response format');
            setAvailableParts([]);
          }
        }
      } catch (error) {
        console.error('Error fetching parts:', error);
        setSnackbarMessage('Failed to load parts from database');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setAvailableParts([]);
      } finally {
        setLoadingParts(false);
      }
    } catch (outerError) {
      console.error('Unexpected error in fetchAvailableParts:', outerError);
      setLoadingParts(false);
    }
  };
  
  // Update the openAddPartDialog to reset custom part fields
  const openAddPartDialog = () => {
    fetchAvailableParts();
    setAddPartDialogOpen(true);
    setIsCustomPart(false);
    setCustomPartName('');
    setCustomPartNumber('');
    setSelectedPartId(null);
    setQuantity(1);
    setUnitPrice(0);
    setPartSearchTerm('');
  };
  
  const closeAddPartDialog = () => {
    setAddPartDialogOpen(false);
  };
  
  const handlePartChange = (partId: number | null) => {
    console.log('handlePartChange called with partId:', partId);
    
    if (!partId) {
      console.log('No part ID provided');
      return;
    }
    
    console.log('Available parts:', availableParts);
    
    const part = availableParts.find(p => p.part_id === partId);
    console.log('Selected part:', part);
    
    if (part) {
      setSelectedPartId(partId);
      
      // Set unit price from part if available
      if (part.unit_cost) {
        setUnitPrice(parseFloat(part.unit_cost.toString()));
        console.log('Setting unit price from part:', part.unit_cost);
      }
    } else {
      console.warn('Part not found with ID:', partId);
    }
  };
  
  // Update the handleAddPartToPO function to handle custom parts
  const handleAddPartToPO = async () => {
    if (!id) return;
    
    try {
      setIsUpdating(true);
      
      let partData: any = {};
      
      if (isCustomPart) {
        // For custom/miscellaneous items
        if (!customPartName) {
          throw new Error('Item name is required');
        }
        
        partData = {
          custom_part: true,
          part_name: customPartName,
          custom_part_name: customPartName,
          part_number: customPartNumber,
          custom_part_number: customPartNumber,
          quantity: quantity,
          unit_price: unitPrice
        };
      } else {
        // For parts from the database
        if (!selectedPartId) {
          throw new Error('No part selected');
        }
        
        partData = {
          part_id: selectedPartId,
          quantity: quantity,
          unit_price: unitPrice
        };
      }
      
      await purchaseOrdersApi.addPartToPO(parseInt(id), partData);
      
      // Refresh purchase order data
      await fetchPurchaseOrder();
      
      setSnackbarMessage('Part added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      closeAddPartDialog();
      
    } catch (error) {
      console.error('Error adding part to PO:', error);
      setSnackbarMessage('Failed to add part to purchase order');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Handle part deletion
  const openDeleteItemDialog = (itemId: number) => {
    setItemToDelete(itemId);
    setDeleteItemDialogOpen(true);
  };
  
  const closeDeleteItemDialog = () => {
    setDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };
  
  const handleDeleteItem = async () => {
    if (!id || !itemToDelete) return;
    
    try {
      setIsUpdating(true);
      
      const response = await purchaseOrdersApi.removePartFromPO(parseInt(id), itemToDelete);
      
      // Refresh purchase order data
      await fetchPurchaseOrder();
      
      setSnackbarMessage('Part removed successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      closeDeleteItemDialog();
      
    } catch (error: any) {
      console.error('Error removing part from PO:', error);
      
      // Handle the specific case of trying to delete the last item
      if (error.response && error.response.status === 400 && 
          error.response.data && error.response.data.message && 
          error.response.data.message.includes('last item')) {
        setSnackbarMessage('Cannot remove the last item from a purchase order. A purchase order must contain at least one item.');
      } else {
        setSnackbarMessage('Failed to remove part from purchase order');
      }
      
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      closeDeleteItemDialog();
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Modify the filter parts logic to handle undefined values
  const filteredParts = partSearchTerm && availableParts
    ? availableParts.filter(part => 
        (part.name && part.name.toLowerCase().includes(partSearchTerm.toLowerCase())) ||
        (part.fiserv_part_number && part.fiserv_part_number.toLowerCase().includes(partSearchTerm.toLowerCase())) ||
        (part.manufacturer_part_number && part.manufacturer_part_number.toLowerCase().includes(partSearchTerm.toLowerCase()))
      )
    : availableParts || [];
  
  // Check if PO is editable (pending or on_hold)
  const isPOEditable = () => {
    return purchaseOrder && (purchaseOrder.status === 'pending' || purchaseOrder.status === 'on_hold');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!purchaseOrder) {
    return <Alert severity="warning">Purchase order not found</Alert>;
  }

  return (
    <Box className="purchase-order-detail" mb={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/purchase-orders')}
          variant="outlined"
        >
          Back to Purchase Orders
        </Button>
        <Box>
          <Button
            startIcon={<Send />}
            onClick={openEmailDialog}
            variant="contained"
            color="secondary"
            sx={{ mr: 2 }}
          >
            Email PDF
          </Button>
          <Button
            startIcon={<PictureAsPdf />}
            onClick={handleExportToPDF}
            variant="contained"
            color="primary"
          >
            Export to PDF
          </Button>
        </Box>
      </Box>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">Purchase Order #{purchaseOrder.po_number}</Typography>
          <Box>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 150, mr: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={handleStatusChange as any}
                label="Status"
                disabled={statusUpdating}
              >
                <MenuItem value="pending">PENDING</MenuItem>
                <MenuItem value="submitted">SUBMITTED</MenuItem>
                <MenuItem value="approved">APPROVED</MenuItem>
                <MenuItem value="on_hold">ON HOLD</MenuItem>
                <MenuItem value="received">RECEIVED</MenuItem>
                <MenuItem value="canceled">CANCELED</MenuItem>
              </Select>
            </FormControl>
            <Chip
              label={status.toUpperCase()}
              color={getStatusColor(status)}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Supplier Information
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" fontWeight="bold">
                    {purchaseOrder.supplier_name || purchaseOrder.vendor_name || 'No Supplier Name'}
                  </Typography>
                </Box>
                
                {(purchaseOrder.contact_name) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person fontSize="small" sx={{ mr: 1, color: 'primary.main' }}/>
                    <Typography variant="body2">Contact: {purchaseOrder.contact_name}</Typography>
                  </Box>
                )}
                
                {(purchaseOrder.supplier_address) && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                    <LocationOn fontSize="small" sx={{ mr: 1, mt: 0.5, color: 'primary.main' }}/>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        whiteSpace: 'pre-line', 
                        wordBreak: 'break-word'
                      }}
                    >
                      {purchaseOrder.supplier_address}
                    </Typography>
                  </Box>
                )}
                
                {(purchaseOrder.supplier_email) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Email fontSize="small" sx={{ mr: 1, color: 'primary.main' }}/>
                    <Typography variant="body2">
                      {purchaseOrder.supplier_email}
                    </Typography>
                  </Box>
                )}
                
                {(purchaseOrder.supplier_phone) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Phone fontSize="small" sx={{ mr: 1, color: 'primary.main' }}/>
                    <Typography variant="body2">
                      {purchaseOrder.supplier_phone}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Order Information
                </Typography>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    PO Number:
                  </Typography>
                  {isEditingPoNumber ? (
                    <Box display="flex" alignItems="center">
                      <TextField
                        size="small"
                        value={editedPoNumber}
                        onChange={(e) => setEditedPoNumber(e.target.value)}
                        sx={{ mr: 1 }}
                      />
                      <IconButton color="primary" onClick={handleSavePoNumber} size="small">
                        <Check fontSize="small" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setIsEditingPoNumber(false)} size="small">
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {purchaseOrder.po_number}
                      </Typography>
                      <IconButton 
                        color="primary" 
                        onClick={handleEditPoNumber} 
                        size="small"
                        sx={{ ml: 1 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    Requested By:
                  </Typography>
                  {isEditingRequestedBy ? (
                    <Box display="flex" alignItems="center">
                      <TextField
                        size="small"
                        value={requestedBy}
                        onChange={(e) => setRequestedBy(e.target.value)}
                        sx={{ mr: 1 }}
                      />
                      <IconButton color="primary" onClick={handleSaveRequestedBy} size="small">
                        <Check fontSize="small" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setIsEditingRequestedBy(false)} size="small">
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {requestedBy || 'Not specified'}
                      </Typography>
                      <IconButton 
                        color="primary" 
                        onClick={() => setIsEditingRequestedBy(true)} 
                        size="small"
                        sx={{ ml: 1 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    Approved By:
                  </Typography>
                  {isEditingApprovedBy ? (
                    <Box display="flex" alignItems="center">
                      <TextField
                        size="small"
                        value={approvedBy}
                        onChange={(e) => setApprovedBy(e.target.value)}
                        sx={{ mr: 1 }}
                      />
                      <IconButton color="primary" onClick={handleSaveApprovedBy} size="small">
                        <Check fontSize="small" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setIsEditingApprovedBy(false)} size="small">
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {approvedBy || 'Not specified'}
                        {status === 'approved' && (
                          <Chip 
                            size="small" 
                            label="APPROVED" 
                            color="success" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {status === 'on_hold' && (
                          <Chip 
                            size="small" 
                            label="ON HOLD" 
                            color="info" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {status === 'rejected' && (
                          <Chip 
                            size="small" 
                            label="REJECTED" 
                            color="error" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Typography>
                      <IconButton 
                        color="primary" 
                        onClick={() => setIsEditingApprovedBy(true)} 
                        size="small"
                        sx={{ ml: 1 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    {status === 'approved' ? 'Date Approved:' : 
                     status === 'on_hold' ? 'Date On Hold:' : 
                     'Date Updated:'}
                  </Typography>
                  <Typography variant="body2">
                    {purchaseOrder.approval_date && (status === 'approved' || status === 'on_hold') 
                      ? format(new Date(purchaseOrder.approval_date), 'MM/dd/yyyy') 
                      : purchaseOrder.updated_at 
                        ? format(new Date(purchaseOrder.updated_at), 'MM/dd/yyyy') 
                        : 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    Status:
                  </Typography>
                  <Typography variant="body2">
                    {purchaseOrder.status?.toUpperCase() || 'PENDING'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                    Total Amount:
                  </Typography>
                  <Typography variant="body2">
                    ${typeof purchaseOrder.total_amount === 'number' ? 
                      purchaseOrder.total_amount.toFixed(2) : 
                      parseFloat(purchaseOrder.total_amount || '0').toFixed(2)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Shipping Options
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Priority:</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant={isUrgent ? "contained" : "outlined"}
                        color="error"
                        size="small"
                        onClick={() => handlePriorityChange(true)}
                        disabled={isUpdating || isUrgent}
                      >
                        Urgent
                      </Button>
                      <Button
                        variant={!isUrgent ? "contained" : "outlined"}
                        color="primary"
                        size="small"
                        onClick={() => handlePriorityChange(false)}
                        disabled={isUpdating || !isUrgent}
                      >
                        Not Urgent
                      </Button>
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Shipping Method:</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant={nextDayAir ? "contained" : "outlined"}
                        color="secondary"
                        size="small"
                        onClick={() => handleShippingChange(true)}
                        disabled={isUpdating || nextDayAir}
                      >
                        Next Day Air
                      </Button>
                      <Button
                        variant={!nextDayAir ? "contained" : "outlined"}
                        color="primary"
                        size="small"
                        onClick={() => handleShippingChange(false)}
                        disabled={isUpdating || !nextDayAir}
                      >
                        Regular Shipping
                      </Button>
                    </Box>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Shipping Cost:</strong>
                    </Typography>
                    <TextField
                      label=""
                      type="number"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      style={{ width: '200px' }}
                      value={shippingCost}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setShippingCost(isNaN(value) ? 0 : value);
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => handleShippingCostChange(shippingCost)}
                    />
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Tax Amount:</strong>
                    </Typography>
                    <TextField
                      label=""
                      type="number"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      style={{ width: '200px' }}
                      value={taxAmount}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setTaxAmount(isNaN(value) ? 0 : value);
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => handleTaxAmountChange(taxAmount)}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h6" gutterBottom sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Order Items
          {isPOEditable() && (
            <Button 
              startIcon={<AddIcon />} 
              variant="contained" 
              size="small" 
              onClick={openAddPartDialog}
            >
              Add Part
            </Button>
          )}
        </Typography>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Part Name</TableCell>
                <TableCell>Part #</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Unit Price</TableCell>
                <TableCell>Total Price</TableCell>
                {isPOEditable() && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrder && purchaseOrder.items && purchaseOrder.items.map((item) => (
                <TableRow key={item.item_id}>
                  <TableCell>
                    {item.custom_part_name || item.part_name || (() => {
                      // Try to extract custom part info from notes if available
                      if (item.notes) {
                        try {
                          const notesData = JSON.parse(item.notes);
                          return notesData.part_name || notesData.custom_part_name || 'No Name';
                        } catch (e) {
                          console.log('Failed to parse notes JSON:', e);
                          return 'No Name';
                        }
                      }
                      return 'No Name';
                    })()}
                  </TableCell>
                  <TableCell>
                    {item.custom_part_number || 
                     item.manufacturer_part_number || 
                     item.fiserv_part_number || 
                     (() => {
                       // Try to extract custom part number from notes if available
                       if (item.notes) {
                         try {
                           const notesData = JSON.parse(item.notes);
                           return notesData.part_number || notesData.custom_part_number || '-';
                         } catch (e) {
                           return '-';
                         }
                       }
                       return '-';
                     })()}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>${typeof item.unit_price === 'number' ? 
                    item.unit_price.toFixed(2) : 
                    parseFloat(item.unit_price || '0').toFixed(2)}</TableCell>
                  <TableCell>${typeof item.total_price === 'number' ? 
                    item.total_price.toFixed(2) : 
                    parseFloat(item.total_price || '0').toFixed(2)}</TableCell>
                  {isPOEditable() && (
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => item.item_id && openDeleteItemDialog(item.item_id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box mt={3} display="flex" justifyContent="flex-end">
          <Typography variant="h6">
            Total: ${typeof purchaseOrder.total_amount === 'number' ? 
              purchaseOrder.total_amount.toFixed(2) : 
              parseFloat(purchaseOrder.total_amount || '0').toFixed(2)}
          </Typography>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="text" 
            onClick={handleDownloadExcel}
            startIcon={<Description />}
            sx={{ textTransform: 'none' }}
          >
            Export to Excel
          </Button>
        </Box>

        {/* Add Email History Section */}
        <Box sx={{ mt: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Button
              startIcon={newEmailUpdate ? <Notifications color="error" /> : <History />}
              onClick={() => setShowEmailHistory(!showEmailHistory)}
              variant="outlined"
              color={newEmailUpdate ? "error" : "primary"}
            >
              Email History {newEmailUpdate && "(New Updates!)"}
              {showEmailHistory ? <ExpandLess /> : <ExpandMore />}
            </Button>
            
            <Button
              startIcon={<Refresh />}
              onClick={refreshEmailHistory}
              disabled={loadingHistory}
              variant="contained"
              color={newEmailUpdate ? "error" : "secondary"}
              size="small"
            >
              Refresh Email Status
            </Button>
          </Box>
          
          {/* Show auto-refresh status when expanded */}
          {showEmailHistory && (
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {loadingHistory ? (
                <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={12} sx={{ mr: 1 }} /> Refreshing...
                </Typography>
              ) : (
                <Typography variant="caption" color="textSecondary">
                  Auto-refreshing every 10 seconds
                </Typography>
              )}
            </Box>
          )}
          
          <Collapse in={showEmailHistory} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {loadingHistory && !emailHistory.length ? (
                <ListItem>
                  <CircularProgress size={20} />
                </ListItem>
              ) : emailHistory.length > 0 ? (
                <>
                  {emailHistory.map((record: EmailTrackingRecord, index) => (
                    <ListItem key={index} sx={{ pl: 4 }}>
                      <ListItemIcon>
                        <Email color={record.status === 'approved' ? 'success' : 
                                   record.status === 'on_hold' ? 'info' : 'primary'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Sent to ${record.recipient_email}`}
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              {new Date(record.sent_date).toLocaleString()}
                            </Typography>
                            {record.status === 'approved' && (
                              <Typography component="span" variant="body2" color="success.main">
                                {' • Approved'}
                              </Typography>
                            )}
                            {record.status === 'on_hold' && (
                              <Typography component="span" variant="body2" color="info.main">
                                {' • On Hold'}
                                {record.notes && record.notes.length < 100 && (
                                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
                                    Note: {record.notes}
                                  </Typography>
                                )}
                              </Typography>
                            )}
                            {record.status === 'rejected' && (
                              <Typography component="span" variant="body2" color="error.main">
                                {' • Rejected'}
                              </Typography>
                            )}
                            {record.status === 'pending' && (
                              <Typography component="span" variant="body2" color="primary">
                                {' • Pending'}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </>
              ) : (
                <ListItem>
                  <ListItemText primary="No email history found" />
                </ListItem>
              )}
            </List>
          </Collapse>
        </Box>
      </Paper>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onClose={closeEmailDialog}>
        <DialogTitle>Send Purchase Order Email</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter the email address where you'd like to send this purchase order PDF.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="email"
            label="Recipient Email"
            type="email"
            fullWidth
            variant="outlined"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            error={!!emailDialogError}
            helperText={emailDialogError}
          />
          <TextField
            margin="dense"
            id="notes"
            label="Email Notes (will be included in the email)"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={emailNotes}
            onChange={(e) => setEmailNotes(e.target.value)}
            placeholder="Enter any notes or additional information to include in the email"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEmailDialog}>Cancel</Button>
          <Button onClick={handleSendEmail} variant="contained" color="primary">Send</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Add Part Dialog */}
      <ModalPortal open={addPartDialogOpen}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">Add Part to Purchase Order</h5>
            </div>
            <div className="dialog-content">
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="customPartSwitch"
                    checked={isCustomPart}
                    onChange={(e) => setIsCustomPart(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="customPartSwitch">
                    Add custom/miscellaneous item
                  </label>
                </div>
              </div>

              {isCustomPart ? (
                <>
                  <div className="mb-3">
                    <label className="form-label">Item Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={customPartName}
                      onChange={(e) => setCustomPartName(e.target.value)}
                      placeholder="Enter custom item name"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Item Number (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={customPartNumber}
                      onChange={(e) => setCustomPartNumber(e.target.value)}
                      placeholder="Enter custom item number"
                    />
                  </div>
                </>
              ) : (
                <div className="mb-3">
                  <label className="form-label">Select Part</label>
                  <div className="search-container">
                    <input
                      type="text"
                      className="form-control"
                      value={partSearchTerm}
                      onChange={(e) => setPartSearchTerm(e.target.value)}
                      placeholder="Search by part number or name"
                    />
                    {loadingParts && (
                      <div className="spinner-border spinner-border-sm text-primary position-absolute" 
                           style={{ right: '1rem', top: '0.75rem' }} 
                           role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    )}
                  </div>

                  {filteredParts.length > 0 && (
                    <div className="search-results">
                      {filteredParts.map((part) => (
                        <div
                          key={`part-${part.part_id}`}
                          className="search-item"
                          onClick={() => handlePartChange(part.part_id)}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold">{part.name}</div>
                              <div className="info-text">
                                Fiserv: {part.fiserv_part_number} | 
                                Mfr: {part.manufacturer_part_number}
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="status-badge status-success">
                                Stock: {part.quantity}
                              </div>
                              <div className="info-text mt-1">
                                {part.unit_cost ? `$${parseFloat(part.unit_cost.toString()).toFixed(2)}` : 'No price'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedPartId && (
                    <div className="info-panel mt-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-bold">
                            {availableParts.find(p => p.part_id === selectedPartId)?.name}
                          </div>
                          <div className="info-text">
                            Selected for purchase order
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setSelectedPartId(null)}
                        >
                          Change Part
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="row mb-3">
                <div className="col-6">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
                <div className="col-6">
                  <label className="form-label">Unit Price</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      step="0.01"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
              </div>
              
              <div className="alert alert-info">
                Total: ${(quantity * unitPrice).toFixed(2)}
              </div>
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeAddPartDialog}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddPartToPO}
                  disabled={
                    (isCustomPart && (!customPartName || quantity <= 0)) || 
                    (!isCustomPart && (!selectedPartId || quantity <= 0))
                  }
                >
                  Add to Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      
      {/* Delete Item Confirmation Dialog */}
      <Dialog open={deleteItemDialogOpen} onClose={closeDeleteItemDialog}>
        <DialogTitle>Remove Part from Purchase Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove this part from the purchase order? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteItemDialog}>Cancel</Button>
          <Button onClick={handleDeleteItem} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrderDetail;
