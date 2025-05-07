import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Grid,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { partsApi, purchaseOrdersApi, suppliersApi } from '../../services/api';
import { Part, Supplier } from '../../types/purchaseOrder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningIcon from '@mui/icons-material/Warning';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { generatePurchaseOrderExcel } from '../../utils/excelTemplates';

const GeneratePurchaseOrders: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPOs, setGeneratedPOs] = useState<any[]>([]);
  const [customPoNumbers, setCustomPoNumbers] = useState<{ [supplierId: string]: string }>({});
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<{ partId: number, supplierId: string } | null>(null);
  const [pendingPOsExist, setPendingPOsExist] = useState<boolean>(false);
  // Add state for selected parts (default is all parts selected)
  const [selectedPartIds, setSelectedPartIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, check if there are any pending POs
      try {
        const purchaseOrdersResponse = await purchaseOrdersApi.getAll();
        // Set the flag but don't stop the process
        if (purchaseOrdersResponse.data.some((po: any) => po.status === 'pending')) {
          setPendingPOsExist(true);
          // Don't return early or set an error, just show the warning
        }
      } catch (error) {
        console.error('Error checking pending purchase orders:', error);
      }
      
      // Continue with the rest of the data loading regardless of pending POs
      
      // Fetch all suppliers
      const suppliersResponse = await suppliersApi.getAll();
      const suppliersList = Array.isArray(suppliersResponse.data) ? suppliersResponse.data : [];
      setSuppliers(suppliersList);
      
      // Fetch parts that need reordering (including both low stock and out of stock)
      const partsResponse = await partsApi.getPartsToReorder();
      console.log('Full parts response:', partsResponse);
      
      // The response is now the full axios response, so we need to access .data
      const partsData = Array.isArray(partsResponse.data) ? partsResponse.data : 
                       (partsResponse.data && typeof partsResponse.data === 'object' ? [partsResponse.data] : []);
      
      console.log('Parts data after processing:', partsData);
      
      // Process the parts data to ensure we have all necessary information
      if (partsData && partsData.length > 0 && suppliersList) {
        console.log('Processing parts data:', partsData);
        
        try {
          // Create a unique set of parts (in case there are duplicates due to multiple suppliers)
          const uniquePartIds = new Set<number>();
          const uniqueParts: Part[] = [];
          
          // Fetch all parts that already have active purchase orders (pending, submitted, or approved)
          const pendingPartsResponse = await purchaseOrdersApi.getPartsWithPendingOrders();
          console.log('Raw pending parts response:', pendingPartsResponse.data);
          
          // Ensure we capture ALL parts with active orders, including those with custom PO numbers
          // This Set will contain all part IDs that should be excluded from the generation list
          const partsWithPendingOrders = new Set(
            pendingPartsResponse.data.flatMap((item: any) => {
              // Check if this is a direct part ID or if it's part of an items array
              if (item.part_id) {
                return [item.part_id];
              } else if (item.items && Array.isArray(item.items)) {
                // Extract part IDs from items array if present
                return item.items.map((subItem: any) => subItem.part_id).filter(Boolean);
              }
              return [];
            })
          );
          
          // Log parts with pending orders for debugging
          console.log('Parts with active orders (pending, submitted, or approved):', Array.from(partsWithPendingOrders));
          
          // Process parts and assign TBD if needed, filtering out parts with active orders
          partsData.forEach((part: Part) => {
            // Skip parts that already have active purchase orders
            if (partsWithPendingOrders.has(part.part_id)) {
              console.log(`Skipping part ${part.part_id} - ${part.name} as it already has an active order (pending, submitted, or approved)`);
              return;
            }
            
            if (!uniquePartIds.has(part.part_id)) {
              uniquePartIds.add(part.part_id);
              
              // If part has no supplier info, assign to a special "TBD" supplier
              let supplierId = part.supplier_id || part.vendor_id;
              let supplierName = part.supplier_name || part.vendor_name || 'TBD';
              
              // If no supplier is assigned, use a special TBD identifier
              // Use -1 as a numeric identifier for TBD suppliers
              if (!supplierId) {
                supplierId = -1; // Special numeric value for TBD
                supplierName = 'TBD';
              } else {
                // If supplier ID exists, try to get the supplier name from the list
                const supplier = suppliersList.find((s: Supplier) => s.supplier_id === supplierId);
                if (supplier) {
                  supplierName = supplier.name;
                }
              }
              
              // Calculate order quantity if not already set
              const orderQuantity = part.order_quantity || Math.max((part.minimum_quantity * 2) - part.quantity, part.minimum_quantity);
              
              // Ensure we have unit price data - log to debug the issue
              console.log('Part pricing data:', {
                part_id: part.part_id,
                name: part.name,
                cost: (part as any).cost, // Check if cost field exists
                unit_cost: part.unit_cost
              });
              
              // During transition: use unit_cost if available, otherwise use cost
              // Eventually we should be able to use only unit_cost
              const unitPrice = 
                part.unit_cost !== undefined ? Number(part.unit_cost) : 
                (part as any).cost !== undefined ? Number((part as any).cost) : 0;
              
              uniqueParts.push({
                ...part,
                supplier_id: supplierId,
                supplier_name: supplierName,
                order_quantity: orderQuantity,
                editable_quantity: orderQuantity, // Add editable quantity that starts with order quantity
                unit_cost: unitPrice // Set unit_cost to ensure it's available in the backend
              });
            }
          });
          
          // Group by supplier - ensure consistent handling of -1 for TBD
          const groupedBySupplier: { [key: string]: Part[] } = {};
          uniqueParts.forEach((part: Part) => {
            // Always convert supplier_id to string for grouping
            // Parts without supplier (supplier_id === -1) will be grouped under '-1'
            const supplierId = part.supplier_id !== undefined ? part.supplier_id.toString() : '-1';
            
            if (!groupedBySupplier[supplierId]) {
              groupedBySupplier[supplierId] = [];
            }
            groupedBySupplier[supplierId].push(part);
          });
          
          // Flatten back to array but keep grouped by supplier
          const result: Part[] = [];
          Object.values(groupedBySupplier).forEach(group => {
            result.push(...group);
          });
          
          setParts(result);
          
          // Initialize all parts as selected by default
          const allPartIds = new Set(result.map(part => part.part_id));
          setSelectedPartIds(allPartIds);
          
          console.log('Final processed parts:', result);
          
          // If no parts need reordering, show a message
          if (result.length === 0) {
            setError('No parts need reordering at this time.');
          }
        } catch (error) {
          console.error('Error processing parts:', error);
        }
      } else {
        // If no parts data, set empty array
        setParts([]);
        console.log('No parts to reorder found in API response');
      }
      
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add an effect to refresh data when the user returns to this page
  useEffect(() => {
    // This will handle cases where the user navigates away and then returns
    const handleFocus = () => {
      console.log('Window focused, refreshing data...');
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleEditPoNumber = (supplierId: string) => {
    setEditingSupplierId(supplierId);
  };

  const handleSavePoNumber = (supplierId: string) => {
    setEditingSupplierId(null);
  };

  const handleCancelEditPoNumber = () => {
    setEditingSupplierId(null);
  };

  const handleCustomPoNumberChange = (supplierId: string, value: string) => {
    setCustomPoNumbers({
      ...customPoNumbers,
      [supplierId]: value
    });
  };

  // Handle editable quantity change
  const handleEditQuantity = (partId: number, supplierId: string) => {
    setEditingQuantity({ partId, supplierId });
  };

  const handleSaveQuantity = () => {
    setEditingQuantity(null);
  };

  const handleCancelEditQuantity = () => {
    // Reset to original calculated quantity
    if (editingQuantity) {
      setParts(parts.map(part => {
        if (part.part_id === editingQuantity.partId) {
          return { ...part, editable_quantity: part.order_quantity };
        }
        return part;
      }));
    }
    setEditingQuantity(null);
  };

  const handleQuantityChange = (partId: number, value: string) => {
    // Update the editable quantity for the specific part
    setParts(parts.map(part => {
      if (part.part_id === partId) {
        const numValue = Number(value) || 0;
        return { ...part, editable_quantity: numValue };
      }
      return part;
    }));
  };

  // Handle part selection for PO generation
  const handlePartSelection = (partId: number, isSelected: boolean) => {
    setSelectedPartIds(prev => {
      const newSelectedPartIds = new Set(prev);
      if (isSelected) {
        newSelectedPartIds.add(partId);
      } else {
        newSelectedPartIds.delete(partId);
      }
      return newSelectedPartIds;
    });
  };

  // Handle select all parts for a supplier
  const handleSelectAllForSupplier = (supplierId: string, selectAll: boolean) => {
    const supplierParts = getPartsBySupplier(supplierId);
    const supplierPartIds = supplierParts.map(part => part.part_id);
    
    setSelectedPartIds(prev => {
      const newSelectedPartIds = new Set(prev);
      
      if (selectAll) {
        // Add all supplier parts to selected set
        supplierPartIds.forEach(id => newSelectedPartIds.add(id));
      } else {
        // Remove all supplier parts from selected set
        supplierPartIds.forEach(id => newSelectedPartIds.delete(id));
      }
      
      return newSelectedPartIds;
    });
  };

  // Handle select all parts for all suppliers
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      // Select all parts
      const allPartIds = new Set(parts.map(part => part.part_id));
      setSelectedPartIds(allPartIds);
    } else {
      // Deselect all parts
      setSelectedPartIds(new Set());
    }
  };

  const handleGeneratePurchaseOrders = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      
      // Get unique supplier IDs to group parts by supplier
      const uniqueSupplierIds = getUniqueSupplierIds();
      
      // Filter to only include selected parts
      const filteredParts = parts.filter(part => selectedPartIds.has(part.part_id));
      
      if (filteredParts.length === 0) {
        setError('No parts selected for ordering');
        setGenerating(false);
        return;
      }
      
      // Create array of parts to order with custom PO numbers
      const partsToOrder = uniqueSupplierIds.flatMap(supplierId => {
        const supplierParts = getPartsBySupplier(supplierId).filter(part => selectedPartIds.has(part.part_id));
        return supplierParts.map(part => ({
          ...part,
          quantity: part.editable_quantity || part.order_quantity, // Use the editable quantity if it exists
          customPoNumber: customPoNumbers[supplierId] || ''
        }));
      });
      
      if (partsToOrder.length === 0) {
        setError('No parts selected for ordering');
        setGenerating(false);
        return;
      }
      
      // Validate that all parts have quantities greater than 0
      const invalidParts = partsToOrder.filter(part => !part.quantity || part.quantity <= 0);
      if (invalidParts.length > 0) {
        setError(`Please set quantities for all parts before generating purchase orders. ${invalidParts.length} part(s) have no quantity specified.`);
        setGenerating(false);
        return;
      }
      
      console.log('Parts to order:', partsToOrder);
      
      // Call API to generate purchase orders
      const response = await purchaseOrdersApi.generateForParts({
        parts: partsToOrder,
        customPoNumbers: customPoNumbers
      });
      
      console.log('Generated POs:', response.data);
      
      // Set generated POs
      setGeneratedPOs(response.data);
      
      // Create a set of part IDs that were successfully ordered
      const orderedPartIds = new Set<number>();
      
      // If the response has purchase_orders or is an array itself
      const purchaseOrders = Array.isArray(response.data) 
        ? response.data 
        : (response.data.purchase_orders || []);
      
      // Extract all part IDs that were successfully included in purchase orders
      purchaseOrders.forEach((po: any) => {
        if (po.items && Array.isArray(po.items)) {
          po.items.forEach((item: any) => {
            if (item.part_id) {
              orderedPartIds.add(item.part_id);
            }
          });
        }
      });
      
      console.log('Parts successfully ordered:', Array.from(orderedPartIds));
      
      // Remove the ordered parts from the parts list
      if (orderedPartIds.size > 0) {
        setParts(prevParts => prevParts.filter(part => !orderedPartIds.has(part.part_id)));
        
        // Also remove them from selectedPartIds
        setSelectedPartIds(prev => {
          const newSelectedPartIds = new Set(prev);
          orderedPartIds.forEach(id => newSelectedPartIds.delete(id));
          return newSelectedPartIds;
        });
      }
      
      setSuccess(`Purchase orders generated successfully! ${orderedPartIds.size} parts have been removed from the list.`);
      
    } catch (error: any) {
      console.error('Error generating purchase orders:', error);
      
      // Handle specific error for pending purchase orders
      if (error.response && error.response.status === 409) {
        const data = error.response.data;
        setError(data.message || 'Cannot generate purchase orders while pending orders exist. Process existing orders first to avoid duplicates.');
        
        // Navigate back to PO list to show the pending orders
        setTimeout(() => {
          navigate('/purchase-orders');
        }, 3000);
      } else {
        setError('Failed to generate purchase orders. Please try again later.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleExportAll = async () => {
    if (!generatedPOs || generatedPOs.length === 0) return;
    
    try {
      setLoading(true);
      
      // Create a zip file containing all POs
      for (const po of generatedPOs) {
        try {
          await generatePurchaseOrderExcel(po);
        } catch (error) {
          console.error(`Error generating Excel for PO ${po.po_number}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error exporting purchase orders:', error);
      setError('Failed to export purchase orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getPartsBySupplier = (supplierId: string) => {
    // Handle both string and number supplier IDs
    const supplierIdStr = supplierId.toString();
    return parts.filter(part => {
      const partSupplierId = (part.supplier_id?.toString() || '0');
      return partSupplierId === supplierIdStr;
    });
  };

  const getSupplierName = (supplierId: string) => {
    // Handle both string and number supplier IDs
    const supplierIdStr = supplierId.toString();
    
    // First try to find in suppliers list
    const supplier = suppliers.find(s => s.supplier_id?.toString() === supplierIdStr);
    if (supplier) {
      return supplier.name;
    }
    
    // If not found in suppliers list, check parts for supplier_name
    const part = parts.find(p => p.supplier_id?.toString() === supplierIdStr);
    return part?.supplier_name || 'Unknown Supplier';
  };

  // Calculate total cost for a supplier
  const getSupplierTotal = (supplierId: string) => {
    const supplierParts = getPartsBySupplier(supplierId);
    return supplierParts.reduce((total, part) => {
      if (!selectedPartIds.has(part.part_id)) return total; // Only include selected parts
      const orderQuantity = part.editable_quantity || part.order_quantity || 0;
      const unitPrice = typeof part.unit_cost === 'number' ? part.unit_cost : 0;
      return total + (orderQuantity * unitPrice);
    }, 0);
  };

  // Get unique supplier IDs from parts
  const getUniqueSupplierIds = () => {
    const uniqueIds: string[] = [];
    parts.forEach(part => {
      const supplierId = (part.supplier_id?.toString() || '0');
      if (!uniqueIds.includes(supplierId)) {
        uniqueIds.push(supplierId);
      }
    });
    return uniqueIds;
  };

  // Check if all parts for a supplier are selected
  const areAllPartsSelectedForSupplier = (supplierId: string) => {
    const supplierParts = getPartsBySupplier(supplierId);
    return supplierParts.every(part => selectedPartIds.has(part.part_id));
  };

  // Get count of selected parts for a supplier
  const getSelectedPartsCountForSupplier = (supplierId: string) => {
    const supplierParts = getPartsBySupplier(supplierId);
    return supplierParts.filter(part => selectedPartIds.has(part.part_id)).length;
  };

  // Render a table for a specific supplier
  const renderSupplierTable = (supplierId: string) => {
    const supplierParts = getPartsBySupplier(supplierId);
    const supplierName = getSupplierName(supplierId);
    const selectedCount = getSelectedPartsCountForSupplier(supplierId);
    const totalCount = supplierParts.length;
    
    return (
      <Paper key={supplierId} elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center">
            <Checkbox
              checked={areAllPartsSelectedForSupplier(supplierId)}
              onChange={(e) => handleSelectAllForSupplier(supplierId, e.target.checked)}
              sx={{ ml: -1 }}
            />
            <Typography variant="h6">{supplierName}</Typography>
          </Box>
          
          <Box display="flex" alignItems="center">
            {editingSupplierId === supplierId ? (
              <>
                <TextField
                  label="Custom PO #"
                  variant="outlined"
                  size="small"
                  value={customPoNumbers[supplierId] || ''}
                  onChange={(e) => handleCustomPoNumberChange(supplierId, e.target.value)}
                  sx={{ width: '150px', mr: 1 }}
                />
                <IconButton
                  color="primary"
                  onClick={() => handleSavePoNumber(supplierId)}
                  size="small"
                >
                  <CheckIcon />
                </IconButton>
                <IconButton
                  color="error"
                  onClick={handleCancelEditPoNumber}
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
              </>
            ) : (
              <>
                {customPoNumbers[supplierId] && (
                  <Chip 
                    label={`PO #: ${customPoNumbers[supplierId]}`} 
                    sx={{ mr: 1 }} 
                    color="info"
                  />
                )}
                <Tooltip title="Set Custom PO Number">
                  <IconButton
                    color="primary"
                    onClick={() => handleEditPoNumber(supplierId)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" width="48px"></TableCell>
                <TableCell>Part #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Current Qty</TableCell>
                <TableCell>Min Qty</TableCell>
                <TableCell>Order Qty</TableCell>
                <TableCell align="right">Unit Price</TableCell>
                <TableCell align="right">Total Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierParts.map(part => (
                <TableRow 
                  key={part.part_id}
                  hover
                  sx={{ 
                    bgcolor: selectedPartIds.has(part.part_id) ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: selectedPartIds.has(part.part_id) ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                    },
                    borderLeft: selectedPartIds.has(part.part_id) ? '4px solid #1976d2' : '4px solid transparent'
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPartIds.has(part.part_id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handlePartSelection(part.part_id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>{part.fiserv_part_number}</TableCell>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{part.quantity}</TableCell>
                  <TableCell>{part.minimum_quantity}</TableCell>
                  <TableCell>
                    {editingQuantity && editingQuantity.partId === part.part_id ? (
                      <Box display="flex" alignItems="center" onClick={(e) => e.stopPropagation()}>
                        <TextField
                          type="number"
                          variant="outlined"
                          size="small"
                          value={part.editable_quantity || 0}
                          onChange={(e) => handleQuantityChange(part.part_id, e.target.value)}
                          inputProps={{ min: 1, style: { width: '60px' } }}
                          required
                          error={(part.editable_quantity || 0) <= 0}
                          helperText={(part.editable_quantity || 0) <= 0 ? "Required" : ""}
                        />
                        <IconButton
                          color="primary"
                          onClick={handleSaveQuantity}
                          size="small"
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={handleCancelEditQuantity}
                          size="small"
                        >
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box display="flex" alignItems="center">
                        <Typography 
                          color={(part.editable_quantity || 0) <= 0 ? "error" : "inherit"}
                          sx={{ fontWeight: (part.editable_quantity || 0) <= 0 ? 'bold' : 'normal' }}
                        >
                          {part.editable_quantity || 0}
                          {(part.editable_quantity || 0) <= 0 && " (Required)"}
                        </Typography>
                        <IconButton
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditQuantity(part.part_id, supplierId);
                          }}
                          size="small"
                          sx={{ ml: 1 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">${typeof part.unit_cost === 'number' ? part.unit_cost.toFixed(2) : '0.00'}</TableCell>
                  <TableCell align="right">
                    ${((typeof part.unit_cost === 'number' ? part.unit_cost : 0) * (part.editable_quantity || part.order_quantity || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5}></TableCell>
                <TableCell align="right"><strong>Total:</strong></TableCell>
                <TableCell align="right">
                  <strong>${getSupplierTotal(supplierId).toFixed(2)}</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  // Get total number of parts across all suppliers
  const getTotalPartsCount = () => parts.length;
  
  // Get total number of selected parts
  const getSelectedPartsCount = () => selectedPartIds.size;

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Generate Purchase Orders</Typography>
        <Box display="flex" gap={2}>
          {generatedPOs.length > 0 && (
            <Button 
              startIcon={<LocalShippingIcon />}
              onClick={() => {
                setGeneratedPOs([]);
                setSuccess(null);
                fetchData();
              }}
              variant="contained"
              color="primary"
            >
              Generate New POs
            </Button>
          )}
          <Button 
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/purchase-orders')}
            variant="outlined"
          >
            Back to Purchase Orders
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      {/* Warning about existing orders - changed to an informational message */}
      {pendingPOsExist && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          icon={<WarningIcon />}
        >
          There are active purchase orders in the system. New orders will only be generated for parts that don't already have active orders.
        </Alert>
      )}
      
      {loading ? (
        <Box display="flex" justifyContent="center" my={5}>
          <CircularProgress />
        </Box>
      ) : parts.length === 0 ? (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <WarningIcon color="warning" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {generatedPOs.length > 0 ? 
              "All parts have been ordered" : 
              "No parts to reorder at this time"}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {generatedPOs.length > 0 ? 
              "All selected parts have had purchase orders generated. Check the list below to view the generated orders." : 
              "All parts are currently above their minimum quantity levels."}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Display parts grouped by supplier */}
          {getUniqueSupplierIds().map(supplierId => 
            renderSupplierTable(supplierId)
          )}
          
          {/* Action buttons */}
          <Box display="flex" justifyContent="center" mt={4} gap={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <LocalShippingIcon />}
              onClick={handleGeneratePurchaseOrders}
              disabled={
                generating || 
                loading || 
                getSelectedPartsCount() === 0 ||
                parts.some(part => selectedPartIds.has(part.part_id) && (part.editable_quantity || 0) <= 0)
              }
            >
              {generating 
                ? 'Generating...' 
                : getSelectedPartsCount() === 0 
                  ? 'Select Parts to Generate POs'
                  : `Generate POs for ${getSelectedPartsCount()} Parts`
              }
            </Button>
          </Box>
          
          {/* Display generated purchase orders */}
          {generatedPOs.length > 0 && (
            <Box mt={5}>
              <Typography variant="h6" gutterBottom>
                Generated Purchase Orders
              </Typography>
              
              <Box display="flex" gap={2} mb={3}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportAll}
                >
                  Export All to Excel
                </Button>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<LocalShippingIcon />}
                  onClick={() => {
                    setGeneratedPOs([]);
                    setSuccess(null);
                    fetchData();
                  }}
                >
                  Generate More POs
                </Button>
              </Box>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>PO Number</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Date Created</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generatedPOs.map(po => (
                      <TableRow key={po.po_id}>
                        <TableCell>{po.po_number}</TableCell>
                        <TableCell>{po.supplier_name || po.vendor_name}</TableCell>
                        <TableCell>
                          {new Date(po.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={po.status.toUpperCase()} 
                            color={
                              po.status === 'pending' ? 'warning' :
                              po.status === 'submitted' ? 'info' :
                              po.status === 'approved' ? 'success' :
                              po.status === 'received' ? 'primary' :
                              'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          ${Number(po.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => navigate(`/purchase-orders/${po.po_id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}
    </div>
  );
};

export default GeneratePurchaseOrders;
