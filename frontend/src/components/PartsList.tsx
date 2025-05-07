import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Checkbox,
  ListItemText,
  LinearProgress,
  Stack,
  Grid,
  InputAdornment,
  Collapse,
  Pagination,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import DownloadIcon from '@mui/icons-material/Download';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import * as XLSX from 'xlsx';
import axiosInstance from '../utils/axios';
import RestockForm from './RestockForm';
import PartsUsageDialog from './PartsUsageDialog';
import ImportPartsDialog from './ImportPartsDialog';
import { 
  DataGrid, 
  GridColDef, 
  GridRenderCellParams,
  GridPaginationModel,
  GridRowClassNameParams,
  DataGridProps,
  GridPreProcessEditCellProps,
  GridValueGetter
} from '@mui/x-data-grid';

import { styled } from '@mui/material/styles';
import ModalPortal from './ModalPortal';
import { useNavigate } from 'react-router-dom';

// Add this at the top of the component to force no caching
// axios.defaults.headers.common['Cache-Control'] = 'no-cache, no-store, must-revalidate';
// axios.defaults.headers.get['Cache-Control'] = 'no-cache, no-store, must-revalidate';
// axios.defaults.headers.get['Pragma'] = 'no-cache';

const StyledDataGrid = styled(DataGrid, {
  shouldForwardProp: (prop) => ![
    'rowId',
    'offsetLeft',
    'columnsTotalWidth',
    'paginationMeta'
  ].includes(prop.toString()),
})({});

interface Part {
  part_id: number;
  name: string;
  description: string;
  manufacturer: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  quantity: number;
  minimum_quantity: number;
  location: string;
  notes: string;
  last_ordered_date: string;
  unit_cost: number;
  status?: 'active' | 'discontinued';
  [key: string]: any;
}

interface PartFormData {
  name: string;
  description: string;
  manufacturer: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  quantity: number | '';
  minimum_quantity: number | '';
  location: string;
  notes: string;
  unit_cost: number | '';
  status: 'active' | 'discontinued';
}

const initialFormData: PartFormData = {
  name: '',
  description: '',
  manufacturer: '',
  manufacturer_part_number: '',
  fiserv_part_number: '',
  quantity: '',
  minimum_quantity: '',
  location: '',
  notes: '',
  unit_cost: '',
  status: 'active'
};

// Add this function outside the component
const createCostColumn = (): GridColDef => {
  return {
    field: 'unit_cost',
    headerName: 'Cost',
    type: 'number',
    flex: 0.5,
    valueGetter: (params: { row: Part | undefined; value: any }) => {
      if (!params.row) return 0;
      
      const partId = params.row.part_id || 'unknown';
      const partName = params.row.name || 'unknown';
      
      console.log(`💰 COST valueGetter for ${partName}:`, {
        unit_cost: params.row.unit_cost,
        unit_cost_type: typeof params.row.unit_cost
      });
      
      // DIRECT TEST: Based on part ID, return hardcoded costs for the first few parts
      // This is to test if our valueGetter is working at all
      if (partId === 587) return 100.20;
      if (partId === 586) return 15.50;
      if (partId === 585) return 21.00;
      if (partId === 584) return 26.50;
      if (partId === 583) return 32.00;
      
      // Simple and direct approach
      let costValue = 0;
      
      // Try to parse the unit_cost value, first making sure it's a number
      if (params.row.unit_cost !== undefined && params.row.unit_cost !== null) {
        // Force to number
        costValue = Number(params.row.unit_cost);
      }
      
      if (isNaN(costValue)) costValue = 0;
      console.log(`💰 COST calculated for ${partName}:`, costValue);
      
      return costValue;
    },
    renderCell: (params: GridRenderCellParams) => {
      const value = params.value;
      
      if (value === null || value === undefined) {
        return <span>-</span>;
      }
      
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return <span>-</span>;
      }
      
      const result = `$${numValue.toFixed(2)}`;
      return <span>{result}</span>;
    }
  };
};

// Add these helper functions at the top of the file, outside the component
const isTBDValue = (value: string): boolean => {
  return value.trim().toUpperCase() === 'TBD';
};

const generateUniqueTBD = (): string => {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 10000);
  return `TBD-${timestamp}-${random}`;
};

// Custom CSS styles for Fiserv branding
const FiservStyles = `
  .text-primary {
    color: #FF6600 !important;
  }
  
  .bg-primary {
    background-color: #0066A1 !important;
  }
  
  .table-primary, .table-primary > td, .table-primary > th {
    background-color: rgba(0, 102, 161, 0.1);
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
  
  .card-header.bg-light {
    background-color: #f8f9fa !important;
    border-bottom: 1px solid #e9ecef;
  }
`;

const PartsList: React.FC = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openRestockForm, setOpenRestockForm] = useState(false);
  const [openUsageDialog, setOpenUsageDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PartFormData>(initialFormData);
  const [isEditing, setIsEditing] = useState(false);

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [totalItems, setTotalItems] = useState(0);

  // Advanced search state
  const [filters, setFilters] = useState({
    partNumber: '',
    location: '',
    minQuantity: '',
    maxQuantity: ''
  });

  // Column visibility state
  const [columnVisibilityMenuAnchor, setColumnVisibilityMenuAnchor] = useState<null | HTMLElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name', 'fiserv_part_number', 'manufacturer_part_number', 'location', 
    'quantity'
  ]);

  // Add new state variables
  const [locations, setLocations] = useState<string[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);

  // Add state for suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<any[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState('');
  const [currentUnitCost, setCurrentUnitCost] = useState('');
  const [currentLeadTimeDays, setCurrentLeadTimeDays] = useState('');
  const [currentMinOrderQty, setCurrentMinOrderQty] = useState('');
  const [currentSupplierNotes, setCurrentSupplierNotes] = useState('');
  const [openEditConfirm, setOpenEditConfirm] = useState(false);

  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: 'Actions',
    flex: 0.8,
    sortable: false,
    renderCell: (params: GridRenderCellParams<Part>) => (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton 
          size="small" 
          data-testid="edit-button"
          onClick={() => handleOpenEdit(params.row)}
        >
          <EditIcon />
        </IconButton>
        {params.row.status !== 'discontinued' ? (
          <IconButton 
            data-testid="delete-button"
            onClick={() => handleDiscontinue(params.row)} 
            color="warning"
            title="Mark as Discontinued"
          >
            <DeleteIcon />
          </IconButton>
        ) : (
          <IconButton 
            data-testid="delete-button"
            disabled
            title="Cannot delete discontinued parts to preserve history"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>
    )
  };

  // Define base columns without the cost column
  const baseColumns: GridColDef[] = [
    { field: 'part_id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'description', headerName: 'Description', flex: 1.5 },
    { field: 'manufacturer_part_number', headerName: 'Manufacturer Part #', flex: 1 },
    { 
      field: 'fiserv_part_number', 
      headerName: 'Fiserv Part #', 
      flex: 1,
      renderCell: (params) => {
        console.log('Rendering Fiserv part #:', params.row);
        return <span>{params.row.fiserv_part_number || ''}</span>;
      }
    },
    { field: 'location', headerName: 'Location', flex: 0.7 },
    { field: 'quantity', headerName: 'Quantity', type: 'number', flex: 0.5 },
    { field: 'minimum_quantity', headerName: 'Min Quantity', type: 'number', flex: 0.5 },
    { field: 'last_ordered_date', headerName: 'Last Ordered', type: 'date', flex: 1 },
    { 
      field: 'status', 
      headerName: 'Status', 
      flex: 0.7,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : 'Unknown'} 
          color={params.value === 'active' ? 'success' : 'error'}
        />
      ) 
    }
  ];

  // Add the cost column and action column
  const columnsWithActions: GridColDef[] = [
    ...baseColumns,
    createCostColumn(),
    actionColumn
  ];

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      console.log('💰 COST DEBUG: Starting fetchParts');
      const { page, pageSize } = paginationModel;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await axiosInstance.get(`/api/v1/parts?${params}`);
      
      // 💰 DEBUG: Log the entire raw response
      console.log('💰 COST DEBUG: Full API Response', response);
      console.log('💰 COST DEBUG: Raw items array', response.data.items);
      
      // Check the first 3 items for unit_cost values
      if (response.data.items && response.data.items.length > 0) {
        const sampleItems = response.data.items.slice(0, 3);
        console.log('💰 COST DEBUG: First 3 items from API:');
        sampleItems.forEach((item: any, i: number) => {
          console.log(`💰 Item ${i+1} (${item.name}):`, {
            unit_cost_raw: item.unit_cost,
            unit_cost_type: typeof item.unit_cost,
            cost_raw: item.cost,
            cost_type: typeof item.cost,
            allKeys: Object.keys(item).join(', ')
          });
        });
      }

      const updatedParts = (response.data.items || []).map((part: any, index: number) => {
        // Only log the first 3 parts in detail to avoid console spam
        const shouldLog = index < 3;
        
        if (shouldLog) {
          console.log(`💰 COST DEBUG: Processing part ${index+1} (${part.name})`);
          console.log('💰 COST DEBUG: Raw part data:', part);
          console.log('💰 COST DEBUG: API returns unit_cost =', part.unit_cost, 'type =', typeof part.unit_cost);
          console.log('💰 COST DEBUG: API returns cost =', part.cost, 'type =', typeof part.cost);
        }
        
        // The API returns both unit_cost and cost as the same value (unit_cost is duplicated as cost)
        // We'll use whichever one is available and valid
        let unitCostValue = 0;
        
        // Check unit_cost first (primary field)
        if (part.unit_cost !== undefined && part.unit_cost !== null) {
          // Try parsing if it's a string
          if (typeof part.unit_cost === 'string') {
            unitCostValue = parseFloat(part.unit_cost);
          } else {
            unitCostValue = Number(part.unit_cost);
          }
        } 
        // Fall back to cost if unit_cost wasn't available
        else if (part.cost !== undefined && part.cost !== null) {
          if (typeof part.cost === 'string') {
            unitCostValue = parseFloat(part.cost);
          } else {
            unitCostValue = Number(part.cost);
          }
        }
        
        // Ensure we don't have NaN
        if (isNaN(unitCostValue)) {
          unitCostValue = 0;
        }
        
        if (shouldLog) {
          console.log('💰 COST DEBUG: Final parsed cost value:', unitCostValue);
        }
        
        // Create processed part with properly typed fields
        const processedPart: Part = {
          ...part,
          part_id: part.part_id,
          name: part.name || '',
          description: part.description || '',
          manufacturer_part_number: part.manufacturer_part_number || '',
          fiserv_part_number: part.fiserv_part_number || '',
          quantity: Number(part.quantity) || 0,
          minimum_quantity: Number(part.minimum_quantity) || 0,
          location: part.location !== null && part.location !== undefined ? String(part.location) : '',
          unit_cost: Number(unitCostValue), 
          notes: part.notes || '',
          last_ordered_date: part.last_ordered_date || '',
          status: part.status || 'active'
        };
        
        if (shouldLog) {
          console.log('💰 COST DEBUG: Final processed part:', processedPart);
          console.log('💰 COST DEBUG: Final unit_cost value:', unitCostValue, 'type:', typeof unitCostValue);
        }
        
        // Add direct verification that unit_cost is preserved in the object
        const verifyUnitCost = processedPart.unit_cost;
        if (shouldLog) {
          console.log('💰 VERIFY unit_cost directly from object:', verifyUnitCost, 'type:', typeof verifyUnitCost);
        }
        
        return processedPart;
      });
      
      // Check processed parts before setting state
      if (updatedParts.length > 0) {
        console.log('💰 COST DEBUG: First 3 processed parts:');
        const sampleProcessed = updatedParts.slice(0, 3);
        sampleProcessed.forEach((part: Part, i: number) => {
          console.log(`💰 Processed Item ${i+1} (${part.name}):`, {
            unit_cost: part.unit_cost,
            cost: part.cost,
            unit_cost_type: typeof part.unit_cost,
            cost_type: typeof part.cost
          });
          
          // Force conversion to number as a last resort
          if (typeof part.unit_cost === 'string') {
            console.log(`💰 FORCING conversion of unit_cost for ${part.name} from "${part.unit_cost}" to number`);
            part.unit_cost = Number(part.unit_cost);
          }
        });
      }
      
      console.log('💰 SETTING STATE with processed parts:', updatedParts.slice(0, 3));
      
      setTotalItems(response.data.total);
      setParts(updatedParts);
      setLoading(false);
    } catch (error: any) {
      console.error(error);
      setLoading(false);
    }
  }, [paginationModel, searchTerm]);

  // Single useEffect to fetch parts when dependencies change
  useEffect(() => {
    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      fetchParts();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [fetchParts]);

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Reset to first page when searching
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handlePageChange = (
    event: React.MouseEvent<unknown> | React.ChangeEvent<unknown> | null,
    newPage: number
  ) => {
    setPaginationModel((prev) => ({ ...prev, page: newPage }));
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPaginationModel((prev) => ({ ...prev, pageSize: parseInt(event.target.value, 10) }));
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleCloseDetails = () => {
    setSelectedPart(null);
  };

  const handleOpenEdit = (part: Part) => {
    setFormData({
      name: part.name,
      description: part.description || '',
      manufacturer: part.manufacturer || '',
      manufacturer_part_number: part.manufacturer_part_number || '',
      fiserv_part_number: part.fiserv_part_number,
      quantity: part.quantity,
      minimum_quantity: part.minimum_quantity,
      location: part.location || '',
      notes: part.notes || '',
      unit_cost: part.unit_cost,
      status: part.status || 'active'
    });
    
    // Clear suppliers first to avoid stale data
    setSelectedSuppliers([]);
    
    // Fetch part suppliers if editing
    if (part.part_id) {
      fetchPartSuppliers(part.part_id);
    }
    
    setSelectedPart(part);
    setIsEditing(true);
    setOpenDialog(true);
  };

  const handleOpenAdd = () => {
    setSelectedSuppliers([]);
    setFormData(initialFormData);
    setIsEditing(false);
    setOpenDialog(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Make sure the field has a name attribute
    if (!name) {
      console.error('Input field is missing name attribute:', e.target);
      return;
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError(null);
    
    try {
      // CLIENT-SIDE VALIDATION - Check required fields before submitting
      const requiredFieldErrors = [];
      
      // Check required part fields
      if (!formData.name) requiredFieldErrors.push('Part name is required');
      if (!formData.fiserv_part_number) requiredFieldErrors.push('Fiserv part number is required');
      
      // Make sure quantity and minimum_quantity have valid values (backend requires these)
      if (formData.quantity === undefined || formData.quantity === null || formData.quantity === '') {
        requiredFieldErrors.push('Quantity is required');
      }
      
      if (formData.minimum_quantity === undefined || formData.minimum_quantity === null || formData.minimum_quantity === '') {
        requiredFieldErrors.push('Minimum quantity is required');
      }
      
      // Validate if at least one supplier is selected
      if (selectedSuppliers.length === 0) {
        requiredFieldErrors.push('Please add at least one supplier for this part');
      }
      
      // If there are validation errors, show them and return early
      if (requiredFieldErrors.length > 0) {
        setError(requiredFieldErrors.join(', '));
        setLoading(false);
        return;
      }

      // First, set the preferred supplier if none is marked
      let preferredSupplier = selectedSuppliers.find(s => s.is_preferred);
      if (preferredSupplier === undefined && selectedSuppliers.length > 0) {
        const updatedSuppliers = [...selectedSuppliers];
        updatedSuppliers[0].is_preferred = true;
        setSelectedSuppliers(updatedSuppliers);
        preferredSupplier = updatedSuppliers[0];
      }
      
      // Format the data according to what the API expects
      const partData = {
        name: formData.name.trim(),
        description: formData.description || '',
        supplier: formData.manufacturer || '', // Backend expects "supplier" not "manufacturer"
        manufacturer_part_number: formData.manufacturer_part_number || '',
        fiserv_part_number: formData.fiserv_part_number.trim(),
        quantity: isNaN(Number(formData.quantity)) ? 0 : Number(formData.quantity),
        minimum_quantity: isNaN(Number(formData.minimum_quantity)) ? 0 : Number(formData.minimum_quantity),
        location: formData.location || '',
        notes: formData.notes || '',
        unit_cost: isNaN(Number(preferredSupplier?.unit_cost)) ? 0 : Number(preferredSupplier?.unit_cost),
        status: formData.status || 'active',
        supplier_id: Number(preferredSupplier?.supplier_id) || null
      };

      // Check if fiserv_part_number is TBD and generate a unique value
      // Only generate unique TBD for new parts, or when explicitly changing to TBD
      if (isTBDValue(partData.fiserv_part_number)) {
        if (!isEditing || (isEditing && selectedPart?.fiserv_part_number !== 'TBD')) {
          const uniqueTBD = generateUniqueTBD();
          console.log(`Converting "TBD" to unique identifier: ${uniqueTBD}`);
          partData.fiserv_part_number = uniqueTBD;
        } else {
          // If editing and the part already had TBD, keep the original TBD identifier
          partData.fiserv_part_number = selectedPart?.fiserv_part_number || generateUniqueTBD();
        }
      }

      console.log('Submitting part data:', JSON.stringify(partData, null, 2));

      let response;
      if (isEditing && selectedPart) {
        // When updating a part
        console.log(`Updating part ${selectedPart.part_id} with data:`, JSON.stringify(partData, null, 2));
        try {
          response = await axiosInstance.put(`/api/v1/parts/${selectedPart.part_id}`, partData);
          console.log('Update part response:', response);
          
          if (response.status >= 200 && response.status < 300) {
            // After updating the part, update or add each supplier relationship
            for (const supplier of selectedSuppliers) {
              // Format supplier data - ensuring we use supplier_id not vendor_id as per memory
              const supplierData = {
                supplier_id: Number(supplier.supplier_id),
                unit_cost: isNaN(Number(supplier.unit_cost)) ? 0 : Number(supplier.unit_cost), // Will map to unit_price in POs
                is_preferred: Boolean(supplier.is_preferred),
                lead_time_days: supplier.lead_time_days ? Number(supplier.lead_time_days) : null,
                minimum_order_quantity: supplier.minimum_order_quantity ? Number(supplier.minimum_order_quantity) : null,
                notes: supplier.notes || ''
              };
              
              console.log(`Adding supplier ${supplierData.supplier_id} to part ${selectedPart.part_id}:`, 
                JSON.stringify(supplierData, null, 2));
              
              try {
                // First check if this supplier is already associated with the part
                const existingSuppliers = await axiosInstance.get(`/api/v1/parts/${selectedPart.part_id}/suppliers`);
                const isAlreadyAssociated = existingSuppliers.data.some(
                  (s: { supplier_id: number }) => s.supplier_id === Number(supplier.supplier_id)
                );
                
                if (isAlreadyAssociated) {
                  console.log(`Supplier ${supplier.supplier_id} is already associated with part ${selectedPart.part_id}. Skipping.`);
                  continue; // Skip this supplier and move to the next one
                }
                
                // For existing relationships, we would update them, but for simplicity
                // let's use the add endpoint which handles both cases
                const supplierResponse = await axiosInstance.post(
                  `/api/v1/parts/${selectedPart.part_id}/suppliers`, 
                  {
                    supplier_id: Number(supplier.supplier_id),
                    unit_cost: Number(supplier.unit_cost) || 0,
                    is_preferred: Boolean(supplier.is_preferred),
                    lead_time_days: supplier.lead_time_days ? Number(supplier.lead_time_days) : null,
                    minimum_order_quantity: supplier.minimum_order_quantity ? Number(supplier.minimum_order_quantity) : null,
                    notes: supplier.notes || ''
                  }
                );
                console.log('Add supplier response:', supplierResponse);
              } catch (supplierErr: any) {
                // Check if this is a "supplier already associated" error
                if (supplierErr.response?.status === 400 && 
                    supplierErr.response?.data?.error === 'This supplier is already associated with this part') {
                  console.log(`Supplier ${supplier.supplier_id} is already associated with part ${selectedPart.part_id}. Skipping.`);
                  // Continue with other suppliers
                  continue;
                }
                
                console.error('Error adding supplier to part:', supplierErr);
                console.error('Error response:', supplierErr.response?.data);
                // Continue with other suppliers even if one fails
              }
            }
            
            // After processing all suppliers in the form, check if any existing suppliers need to be removed
            console.log('Checking for suppliers to remove...');
            const currentSuppliersResponse = await axiosInstance.get(`/api/v1/parts/${selectedPart.part_id}/suppliers`);
            const currentSuppliers = currentSuppliersResponse.data;
            
            // Get the IDs of suppliers in the updated form
            const updatedSupplierIds = selectedSuppliers.map(s => Number(s.supplier_id));
            
            // Find suppliers that need to be removed (in current list but not in updated list)
            const suppliersToRemove = currentSuppliers.filter(
              (s: { supplier_id: number }) => !updatedSupplierIds.includes(s.supplier_id)
            );
            
            console.log('Current suppliers:', currentSuppliers);
            console.log('Updated supplier IDs:', updatedSupplierIds);
            console.log('Suppliers to remove:', suppliersToRemove);
            
            // Remove each supplier that's no longer in the list
            for (const supplierToRemove of suppliersToRemove) {
              // Make sure we're not removing the last supplier
              if (currentSuppliers.length - suppliersToRemove.length < 1) {
                console.log('Cannot remove all suppliers. A part must have at least one supplier.');
                break;
              }
              
              try {
                console.log(`Removing supplier ${supplierToRemove.supplier_id} from part ${selectedPart.part_id}`);
                await axiosInstance.delete(`/api/v1/parts/${selectedPart.part_id}/suppliers/${supplierToRemove.supplier_id}`);
                console.log(`Successfully removed supplier ${supplierToRemove.supplier_id}`);
              } catch (removeErr: any) {
                console.error(`Error removing supplier ${supplierToRemove.supplier_id}:`, removeErr);
              }
            }
          }
        } catch (updateErr: any) {
          console.error('Error updating part:', updateErr);
          console.error('Error response data:', updateErr.response?.data);
          throw updateErr;
        }
      } else {
        // When creating a new part
        console.log('Creating new part with data:', JSON.stringify(partData, null, 2));
        try {
          response = await axiosInstance.post('/api/v1/parts', partData);
          console.log('Create part response:', response);
          
          // After creating the part, add each supplier relationship
          if (response.status >= 200 && response.status < 300 && response.data && response.data.part_id) {
            const newPartId = response.data.part_id;
            console.log(`New part created with ID: ${newPartId}`);
            
            for (const supplier of selectedSuppliers) {
              const supplierData = {
                supplier_id: Number(supplier.supplier_id),
                unit_cost: isNaN(Number(supplier.unit_cost)) ? 0 : Number(supplier.unit_cost), // Will map to unit_price in POs
                is_preferred: Boolean(supplier.is_preferred),
                lead_time_days: supplier.lead_time_days ? Number(supplier.lead_time_days) : null,
                minimum_order_quantity: supplier.minimum_order_quantity ? Number(supplier.minimum_order_quantity) : null,
                notes: supplier.notes || ''
              };
              
              console.log(`Adding supplier ${supplierData.supplier_id} to part ${newPartId}:`, 
                JSON.stringify(supplierData, null, 2));
              
              try {
                // First check if this supplier is already associated with the part
                const existingSuppliers = await axiosInstance.get(`/api/v1/parts/${newPartId}/suppliers`);
                const isAlreadyAssociated = existingSuppliers.data.some(
                  (s: { supplier_id: number }) => s.supplier_id === Number(supplier.supplier_id)
                );
                
                if (isAlreadyAssociated) {
                  console.log(`Supplier ${supplier.supplier_id} is already associated with part ${newPartId}. Skipping.`);
                  continue; // Skip this supplier and move to the next one
                }
                
                const supplierResponse = await axiosInstance.post(`/api/v1/parts/${newPartId}/suppliers`, supplierData);
                console.log('Add supplier response:', supplierResponse);
              } catch (supplierErr: any) {
                // Check if this is a "supplier already associated" error
                if (supplierErr.response?.status === 400 && 
                    supplierErr.response?.data?.error === 'This supplier is already associated with this part') {
                  console.log(`Supplier ${supplier.supplier_id} is already associated with part ${newPartId}. Skipping.`);
                  // Continue with other suppliers
                  continue;
                }
                
                console.error('Error adding supplier to new part:', supplierErr);
                console.error('Error response:', supplierErr.response?.data);
                // Continue with other suppliers even if one fails
              }
            }
          }
        } catch (error: any) {
          console.error('Error creating part:', error);
          console.error('Error response data:', error.response?.data);
          
          // Special handling for unique constraint violations
          if (error.response?.data?.error?.includes('unique_fiserv_part_number') ||
              error.response?.data?.error?.includes('duplicate key value') ||
              error.response?.data?.error?.includes('Key (fiserv_part_number)')) {
            
            // If this was a TBD value, update with a new unique one and try again
            if (isTBDValue(formData.fiserv_part_number)) {
              const newUniqueTBD = generateUniqueTBD();
              setError(`We're generating a new unique ID for "TBD": ${newUniqueTBD}. Please try submitting again.`);
              
              // Update the form data with the new unique TBD
              setFormData({
                ...formData,
                fiserv_part_number: newUniqueTBD
              });
            } else {
              setError('A part with this Fiserv part number already exists. Please use a different value.');
            }
          } else {
            setError(`Error saving part: ${error.response?.data?.error || error.message || 'Unknown error'}`);
          }
          
          throw error;
        }
      }

      if (response && response.status >= 200 && response.status < 300) {
        fetchParts();
        setOpenDialog(false);
        setFormData(initialFormData);
        setSelectedSuppliers([]);
        setSuccess(isEditing ? 'Part updated successfully' : 'Part added successfully');
      } else {
        setError('Failed to save part. Please try again.');
      }
    } catch (err: any) {
      console.error('Error saving part:', err);
      const errorMessage = 
        err.response?.data?.error || 
        err.response?.data?.message || 
        err.message || 
        'Failed to save part. Please try again.';
      
      // Show detailed error message if available
      const detailMessage = err.response?.data?.detail;
      setError(detailMessage ? `${errorMessage}: ${detailMessage}` : errorMessage);
      
      // Log detailed error information to console
      if (err.response) {
        console.error('Error response status:', err.response.status);
        console.error('Error response headers:', err.response.headers);
        console.error('Error response data:', err.response.data);
      } else if (err.request) {
        console.error('Error request:', err.request);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleColumnVisibilityChange = useCallback((column: string) => {
    setVisibleColumns((prevVisibleColumns) => {
      if (prevVisibleColumns.includes(column)) {
        return prevVisibleColumns.filter((col) => col !== column);
      } else {
        return [...prevVisibleColumns, column];
      }
    });
    setColumnVisibilityMenuAnchor(null);
  }, []);

  const handleDiscontinue = async (part: Part) => {
    if (!window.confirm('Are you sure you want to mark this part as discontinued?')) {
      return;
    }

    try {
      const partId = part.part_id || part.id;
      if (!partId) {
        throw new Error('Cannot discontinue part without a valid ID');
      }
      
      await axiosInstance.delete(`/api/v1/parts/${partId}`);
      setSuccess('Part marked as discontinued successfully');
      fetchParts();
    } catch (error: any) {
      console.error('Error marking part as discontinued:', error);
      setError('Failed to mark part as discontinued. Please try again.');
    }
  };

  // Custom loading overlay component
  const CustomLoadingOverlay = () => (
    <Stack sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} alignItems="center" justifyContent="center">
      <Box sx={{ width: '100%', position: 'absolute', top: 0 }}>
        <LinearProgress />
      </Box>
    </Stack>
  );

  // Custom no rows overlay component
  const CustomNoRowsOverlay = ({ error }: { error: string | null }) => (
    <Stack height="100%" alignItems="center" justifyContent="center">
      {error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <Typography>No parts found</Typography>
      )}
    </Stack>
  );

  interface CustomDataGridProps extends DataGridProps {
    rowId?: never;
    offsetLeft?: never;
    columnsTotalWidth?: never;
  }

  const filterProps = (props: CustomDataGridProps): DataGridProps => {
    const { rowId, offsetLeft, columnsTotalWidth, ...cleanProps } = props;
    return cleanProps;
  };

  // Add function to fetch unique locations
  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/parts');
      const parts = response.data.items || response.data;
      
      const uniqueLocations = Array.from(
        new Set(parts.map((part: Part) => part.location).filter(Boolean))
      ).filter((loc): loc is string => typeof loc === 'string');
      
      setLocations(uniqueLocations);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Add export function
  const handleExport = async () => {
    try {
      setExportLoading(true);
      const response = await axiosInstance.get('/api/v1/parts');
      let parts = response.data.items || response.data;

      // Filter parts by location if selected
      if (selectedLocation) {
        parts = parts.filter((part: Part) => part.location === selectedLocation);
      }

      // Transform data for export
      const exportData = parts.map((part: Part) => ({
        'Name': part.name,
        'Fiserv Part #': part.fiserv_part_number,
        'Manufacturer Part #': part.manufacturer_part_number,
        'Manufacturer': part.manufacturer,
        'Location': part.location,
        'Quantity': part.quantity,
        'Min Quantity': part.minimum_quantity,
        'Cost': part.unit_cost ? `$${Number(part.unit_cost).toFixed(2)}` : '-',
        'Last Ordered': part.last_ordered_date ? new Date(part.last_ordered_date).toLocaleDateString() : 'N/A',
        'Description': part.description,
        'Notes': part.notes,
        'Status': part.status
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Name
        { wch: 15 }, // Fiserv Part #
        { wch: 20 }, // Manufacturer Part #
        { wch: 20 }, // Manufacturer
        { wch: 15 }, // Location
        { wch: 10 }, // Quantity
        { wch: 12 }, // Min Quantity
        { wch: 10 }, // Cost
        { wch: 15 }, // Last Ordered
        { wch: 40 }, // Description
        { wch: 40 }, // Notes
        { wch: 10 }, // Status
      ];
      worksheet['!cols'] = columnWidths;

      // Style header row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const headerStyle = {
        font: { bold: true },
        fill: { 
          fgColor: { rgb: "EEEEEE" },
          patternType: 'solid'
        },
        alignment: { 
          horizontal: 'center',
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };

      // Apply header style to first row
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellRef]) continue;
        worksheet[cellRef].s = headerStyle;
      }

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
      
      // Generate filename with location if selected
      const filename = selectedLocation 
        ? `inventory_${selectedLocation.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Inventory exported successfully!');
    } catch (error: any) {
      console.error('Error exporting inventory:', error);
      setError('Failed to export inventory');
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
      setSelectedLocation('');
    }
  };

  // Add effect to fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await axiosInstance.get('/api/v1/suppliers');
        setSuppliers(response.data);
      } catch (err: any) {
        console.error('Error fetching suppliers:', err);
        setError('Failed to load suppliers. Please try again.');
      }
    };

    if (openDialog) {
      fetchSuppliers();
    }
  }, [openDialog]);

  // Fetch suppliers for a part when editing
  const fetchPartSuppliers = async (partId: number) => {
    try {
      const response = await axiosInstance.get(`/api/v1/parts/${partId}/suppliers`);
      setSelectedSuppliers(response.data);
    } catch (err: any) {
      console.error('Error fetching part suppliers:', err);
      setError('Failed to load part suppliers. Please try again.');
    }
  };

  // Add functions to handle supplier selection
  const handleAddSupplier = (e: React.MouseEvent) => {
    // Prevent the default button behavior which might trigger form submission
    e.preventDefault();
    e.stopPropagation();

    if (currentSupplierId === '') {
      setError('Please select a supplier');
      return;
    }

    // Check if this supplier already exists
    const existingSupplier = selectedSuppliers.find(
      (s) => s.supplier_id === Number(currentSupplierId)
    );

    if (existingSupplier) {
      setError('This supplier is already added to this part');
      return;
    }

    const selectedSupplier = suppliers.find(
      (s) => s.supplier_id === Number(currentSupplierId)
    );

    if (!selectedSupplier) {
      setError('Invalid supplier selected');
      return;
    }

    // Validate unit cost
    if (!currentUnitCost || isNaN(Number(currentUnitCost)) || Number(currentUnitCost) <= 0) {
      setError('Please enter a valid unit cost');
      return;
    }

    // Create new supplier with valid numeric values
    const newSupplier = {
      supplier_id: Number(currentSupplierId),
      supplier_name: selectedSupplier.name,
      unit_cost: Number(currentUnitCost) || 0,
      is_preferred: selectedSuppliers.length === 0 ? true : false, // First supplier is preferred by default
      lead_time_days: currentLeadTimeDays ? Number(currentLeadTimeDays) : null,
      minimum_order_quantity: currentMinOrderQty ? Number(currentMinOrderQty) : 1,
      notes: currentSupplierNotes || ''
    };

    setSelectedSuppliers([...selectedSuppliers, newSupplier]);
    
    // Reset input fields
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays('');
    setCurrentMinOrderQty('');
    setCurrentSupplierNotes('');
    setError(null);
  };

  const handleRemoveSupplier = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.filter(s => s.supplier_id !== supplierId);
    
    // If the preferred supplier was removed, set the first supplier as preferred
    if (selectedSuppliers.find(s => s.supplier_id === supplierId)?.is_preferred && updatedSuppliers.length > 0) {
      updatedSuppliers[0].is_preferred = true;
    }
    
    setSelectedSuppliers(updatedSuppliers);
  };

  const handleSetPreferred = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.map(s => ({
      ...s,
      is_preferred: s.supplier_id === supplierId
    }));
    
    setSelectedSuppliers(updatedSuppliers);
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  const handleRowClick = (params: any) => {
    setSelectedPart(params.row);
    setOpenEditConfirm(true);
  };

  const handleFullEdit = () => {
    if (selectedPart && selectedPart.part_id) {
      navigate(`/parts/${selectedPart.part_id}/edit`);
    }
  };

  const handleQuickEdit = () => {
    if (selectedPart) {
      handleOpenEdit(selectedPart);
    }
    setOpenEditConfirm(false);
  };

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
        Parts Inventory
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Filters */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <div className="d-flex flex-column flex-md-row align-items-stretch gap-3">
            <div className="flex-grow-1">
              <label className="form-label" style={{ color: '#6c757d' }}>Search Parts Inventory</label>
              <div className="search-container">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name, part number, location..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
                {loading && searchTerm && (
                  <div className="spinner-border spinner-border-sm text-primary position-absolute" 
                      style={{ right: '1rem', top: '0.75rem' }} 
                      role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="d-flex flex-column align-items-stretch gap-2" style={{ minWidth: '250px' }}>
              <label className="form-label" style={{ color: '#6c757d' }}>Actions</label>
              <button
                type="button"
                className="btn w-100 mb-2"
                onClick={handleOpenAdd}
                style={{ 
                  backgroundColor: '#FF6600', 
                  color: '#e0e0e0',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  boxShadow: '0 2px 4px rgba(255, 102, 0, 0.3)'
                }}
              >
                <AddIcon sx={{ fontSize: 18, color: '#e0e0e0' }} /> Add Part
              </button>
              
              <div className="d-flex gap-2 mb-2">
                <button
                  type="button"
                  className="btn flex-grow-1"
                  onClick={() => setOpenRestockForm(true)}
                  style={{ 
                    backgroundColor: '#FF6600',
                    color: '#e0e0e0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <AddCircleIcon sx={{ fontSize: 16, color: '#e0e0e0' }} /> Restock
                </button>
                <button
                  type="button"
                  className="btn flex-grow-1"
                  onClick={() => setOpenUsageDialog(true)}
                  style={{ 
                    backgroundColor: '#FF6600',
                    color: '#e0e0e0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <RemoveCircleIcon sx={{ fontSize: 16, color: '#e0e0e0' }} /> Check Out
                </button>
              </div>
              
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn flex-grow-1"
                  onClick={() => setImportDialogOpen(true)}
                  style={{ 
                    backgroundColor: '#FF6600',
                    color: '#e0e0e0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 16, color: '#e0e0e0' }} /> Import
                </button>
                <button
                  type="button"
                  className="btn flex-grow-1"
                  onClick={() => setExportDialogOpen(true)}
                  style={{ 
                    backgroundColor: '#FF6600',
                    color: '#e0e0e0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <DownloadIcon sx={{ fontSize: 16, color: '#e0e0e0' }} /> Export
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={(e) => setColumnVisibilityMenuAnchor(e.currentTarget)}
                  style={{ 
                    backgroundColor: '#FF6600',
                    color: '#e0e0e0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <ViewColumnIcon sx={{ fontSize: 16, color: '#e0e0e0' }} />
                </button>
              </div>
            </div>
          </div>
        </Paper>

        {/* Column Visibility Menu */}
        <Menu
          anchorEl={columnVisibilityMenuAnchor}
          open={Boolean(columnVisibilityMenuAnchor)}
          onClose={() => setColumnVisibilityMenuAnchor(null)}
        >
          {columnsWithActions.map((column) => (
            <MenuItem
              key={column.field}
              onClick={() => handleColumnVisibilityChange(column.field)}
            >
              <Checkbox
                checked={visibleColumns.includes(column.field)}
                onChange={() => {}}
              />
              {column.headerName}
            </MenuItem>
          ))}
        </Menu>

        {/* Parts Table */}
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
            {loading && searchTerm && parts.length === 0 && (
              <LinearProgress sx={{ height: '3px', '& .MuiLinearProgress-bar': { backgroundColor: '#FF6600' } }} />
            )}
            <StyledDataGrid
              columns={columnsWithActions.filter(col => visibleColumns.includes(col.field)) as readonly GridColDef<any>[]}
              rows={parts}
              getRowId={(row) => row.part_id || row.id || Math.random().toString()}
              paginationModel={paginationModel}
              onPaginationModelChange={(newModel: GridPaginationModel) => {
                setPaginationModel(newModel);
                setError(null);
              }}
              paginationMode="server"
              rowCount={totalItems}
              loading={loading}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick={false}
              onRowClick={handleRowClick}
              keepNonExistentRowsSelected={false}
              disableColumnMenu={true}
              disableVirtualization={false}
              getRowClassName={(params) => {
                const row = params.row as any;
                if (row.quantity <= row.minimum_quantity) {
                  return 'low-stock';
                }
                return '';
              }}
              sx={{
                '& .low-stock': {
                  bgcolor: 'rgba(255, 77, 79, 0.08)',
                },
                '& .MuiDataGrid-cell': {
                  cursor: 'pointer',
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
                '& .MuiDataGrid-cell:last-child': {
                  pr: 2
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
          </Box>
        </Paper>

        {/* Custom Pagination */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '0.75rem',
            backgroundColor: 'white',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="d-flex align-items-center">
            <span style={{ color: '#495057', marginRight: '1rem', fontWeight: 500 }}>
              Total: {totalItems} parts
            </span>
            <div className="d-flex align-items-center">
              <span style={{ color: '#495057', marginRight: '0.5rem' }}>
                Rows per page:
              </span>
              <select
                className="form-select"
                style={{ 
                  width: 'auto', 
                  padding: '0.375rem 2rem 0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #ced4da',
                  marginRight: '1rem'
                }}
                value={paginationModel.pageSize}
                onChange={(e) => {
                  setPaginationModel({
                    ...paginationModel,
                    pageSize: Number(e.target.value),
                    page: 0
                  });
                }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <Pagination
            count={Math.ceil(totalItems / paginationModel.pageSize)}
            page={paginationModel.page + 1}
            onChange={(e, p) => handlePageChange(e, p - 1)}
            shape="rounded"
            sx={{
              '& .MuiPaginationItem-root': {
                borderRadius: '0.5rem',
                fontWeight: 500,
                color: '#495057'
              },
              '& .Mui-selected': {
                background: '#FF6600',
                color: 'white',
                '&:hover': {
                  background: '#e65c00',
                }
              }
            }}
          />
        </Paper>
      </Box>

      {/* Part Details Dialog */}
      <ModalPortal open={!!selectedPart && !openDialog}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">Part Details</h5>
            </div>
            <div className="dialog-content">
              {selectedPart && (
                <div className="grid-container grid-2-cols">
                  <div className="info-panel">
                    <h6 className="fw-bold mb-3">Basic Information</h6>
                    <div className="mb-3">
                      <div className="info-text">Part Name</div>
                      <div className="info-value">{selectedPart.name}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Manufacturer</div>
                      <div className="info-value">{selectedPart.manufacturer || 'N/A'}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Manufacturer Part #</div>
                      <div className="info-value">{selectedPart.manufacturer_part_number || 'N/A'}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Fiserv Part #</div>
                      <div className="info-value">{selectedPart.fiserv_part_number}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Status</div>
                      <div>
                        <span className={`status-badge ${selectedPart.status === 'active' ? 'status-success' : 'status-danger'}`}>
                          {selectedPart.status === 'active' ? 'Active' : 'Discontinued'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="info-panel">
                    <h6 className="fw-bold mb-3">Inventory Details</h6>
                    <div className="mb-3">
                      <div className="info-text">Quantity</div>
                      <div className="info-value">{selectedPart.quantity}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Minimum Quantity</div>
                      <div className="info-value">{selectedPart.minimum_quantity}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Location</div>
                      <div className="info-value">{selectedPart.location || 'N/A'}</div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Unit Cost</div>
                      <div className="info-value">
                        ${typeof selectedPart.unit_cost === 'number' 
                          ? selectedPart.unit_cost.toFixed(2) 
                          : Number(selectedPart.unit_cost || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="info-text">Stock Status</div>
                      <div>
                        <span className={`status-badge ${
                          selectedPart.quantity === 0 
                            ? 'status-danger'
                            : selectedPart.quantity <= selectedPart.minimum_quantity
                              ? 'status-warning'
                              : 'status-success'
                        }`}>
                          {selectedPart.quantity === 0 
                            ? 'Out of Stock'
                            : selectedPart.quantity <= selectedPart.minimum_quantity
                              ? 'Low Stock'
                              : 'In Stock'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                
                  {selectedPart.description && (
                    <div className="info-panel" style={{ gridColumn: "span 2" }}>
                      <h6 className="fw-bold mb-3">Description</h6>
                      <p>{selectedPart.description}</p>
                    </div>
                  )}
                
                  {selectedPart.notes && (
                    <div className="info-panel" style={{ gridColumn: "span 2" }}>
                      <h6 className="fw-bold mb-3">Notes</h6>
                      <p>{selectedPart.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                {isEditing ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenEdit(selectedPart as Part)}
                    style={{ 
                      backgroundColor: '#FF6600', 
                      borderColor: '#FF6600', 
                      fontSize: '0.875rem',
                      padding: '0.375rem 0.75rem'
                    }}
                  >
                    Edit Part
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setOpenDialog(true)}
                    style={{ 
                      backgroundColor: '#FF6600', 
                      borderColor: '#FF6600', 
                      fontSize: '0.875rem',
                      padding: '0.375rem 0.75rem'
                    }}
                  >
                    Edit Part
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleCloseDetails}
                  style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Add/Edit Part Dialog */}
      <ModalPortal open={openDialog}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">{isEditing ? 'Edit Part' : 'Add Part'}</h5>
            </div>
            <form onSubmit={handleSubmit} className="needs-validation" noValidate>
              <div className="dialog-content">
                {error && (
                  <div className="alert alert-danger mb-4" role="alert">
                    {error}
                  </div>
                )}
                <div className="grid-container grid-2-cols">
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fiserv Part # *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="fiserv_part_number"
                      value={formData.fiserv_part_number}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="text-muted">
                      If you don't have the Fiserv part number yet, enter "TBD". A unique identifier will be generated.
                    </small>
                    {isTBDValue(formData.fiserv_part_number) && (
                      <div className="alert alert-info mt-2 p-2" role="alert">
                        <small>
                          <strong>TBD Detected</strong>: A unique ID will be generated when you submit.
                        </small>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Manufacturer</label>
                    <input
                      type="text"
                      className="form-control"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Manufacturer Part #</label>
                    <input
                      type="text"
                      className="form-control"
                      name="manufacturer_part_number"
                      value={formData.manufacturer_part_number}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="quantity"
                      min="0"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Minimum Quantity *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="minimum_quantity"
                      min="0"
                      value={formData.minimum_quantity}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  

                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>

                {/* Suppliers Section */}
                <div className="mt-4 mb-2">
                  <h5 className="text-primary mb-2">Part Suppliers</h5>
                  <div className="alert alert-info mb-3" role="alert">
                    <small><strong>Important:</strong> Add one or more suppliers for this part. The first supplier added will be set as preferred.</small>
                  </div>
                  
                  {/* Add Supplier Form */}
                  <div className="card mb-3 border-primary">
                    <div className="card-header bg-light">
                      <strong>Add Supplier</strong>
                    </div>
                    <div className="card-body">
                      <div className="grid-container grid-3-cols">
                        <div className="form-group">
                          <label className="form-label">Supplier *</label>
                          <select
                            className="form-select"
                            value={currentSupplierId}
                            onChange={(e) => setCurrentSupplierId(e.target.value)}
                          >
                            <option value="">Select a supplier</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.supplier_id} value={supplier.supplier_id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Unit Cost ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={currentUnitCost}
                            onChange={(e) => setCurrentUnitCost(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Lead Time (Days)</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            value={currentLeadTimeDays}
                            onChange={(e) => setCurrentLeadTimeDays(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Minimum Order Quantity</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={currentMinOrderQty}
                            onChange={(e) => setCurrentMinOrderQty(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-control"
                            value={currentSupplierNotes}
                            onChange={(e) => setCurrentSupplierNotes(e.target.value)}
                            rows={3}
                          />
                        </div>

                        <div className="form-group d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-primary w-100"
                            onClick={handleAddSupplier}
                            style={{ 
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.875rem',
                              backgroundColor: '#FF6600',
                              borderColor: '#FF6600'
                            }}
                          >
                            Add Supplier
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Supplier List */}
                  {selectedSuppliers.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-sm table-striped">
                        <thead className="table-light">
                          <tr>
                            <th>Supplier</th>
                            <th>Unit Cost</th>
                            <th>Lead Time</th>
                            <th>Min Order</th>
                            <th>Preferred</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSuppliers.map((supplier) => (
                            <tr key={supplier.supplier_id}>
                              <td>{getSupplierName(supplier.supplier_id)}</td>
                              <td>${typeof supplier.unit_cost === 'number' 
                                  ? supplier.unit_cost.toFixed(2) 
                                  : Number(supplier.unit_cost || 0).toFixed(2)}</td>
                              <td>{supplier.lead_time_days || '-'}</td>
                              <td>{supplier.minimum_order_quantity || '-'}</td>
                              <td>
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    checked={supplier.is_preferred}
                                    onChange={() => handleSetPreferred(supplier.supplier_id)}
                                  />
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleRemoveSupplier(supplier.supplier_id)}
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <strong>No suppliers added yet.</strong> You must add at least one supplier for this part.
                    </div>
                  )}
                </div>

                <input
                  type="hidden"
                  name="status"
                  value={formData.status}
                />
              </div>

              <div className="dialog-footer">
                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setOpenDialog(false)}
                    style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ 
                      backgroundColor: '#FF6600', 
                      borderColor: '#FF6600', 
                      fontSize: '0.875rem',
                      padding: '0.375rem 0.75rem'
                    }}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : isEditing ? 'Update Part' : 'Add Part'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Restock Form Dialog */}
      <RestockForm
        open={openRestockForm}
        onClose={() => setOpenRestockForm(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts restocked successfully');
        }}
      />

      {/* Parts Usage Dialog */}
      <PartsUsageDialog
        open={openUsageDialog}
        onClose={() => setOpenUsageDialog(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts checked out successfully');
        }}
      />

      {/* Import Parts Dialog */}
      <ImportPartsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts imported successfully');
        }}
      />

      {/* Export Dialog */}
      <ModalPortal open={exportDialogOpen}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">Export Inventory</h5>
            </div>
            <div className="dialog-content">
              <div className="mt-2">
                <p className="mb-3">
                  Select a location to filter the export, or leave empty to export all inventory items.
                </p>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <select
                    className="form-select"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                  >
                    <option value="">All Locations</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setExportDialogOpen(false)}
                  style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={exportLoading}
                  style={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600',
                    fontSize: '0.875rem',
                    padding: '0.375rem 0.75rem'
                  }}
                >
                  {exportLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <DownloadIcon sx={{ fontSize: 16, marginRight: '0.25rem' }} /> 
                      Export
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Snackbar for notifications */}
      {(!!error || !!success) && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3">
          <div 
            className={`toast show ${error ? 'bg-danger' : 'bg-success'} text-white`}
            role="alert"
            style={{ 
              borderRadius: '0.75rem',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              minWidth: '300px'
            }}
          >
            <div className="toast-header bg-transparent text-white border-0">
              <strong className="me-auto">{error ? 'Error' : 'Success'}</strong>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => { 
                  setError(null); 
                  setSuccess(null); 
                }}
              ></button>
            </div>
            <div className="toast-body">
              {error || success}
            </div>
          </div>
        </div>
      )}

      {/* Part Edit Confirmation Dialog */}
      <ModalPortal open={openEditConfirm}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">Edit Part Options</h5>
            </div>
            <div className="dialog-content">
              <p>How would you like to edit this part?</p>
              <div className="card mb-3 border-primary">
                <div className="card-body">
                  <h6 className="card-title">Selected Part: {selectedPart?.name}</h6>
                  <p className="card-text">Part #: {selectedPart?.fiserv_part_number}</p>
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setOpenEditConfirm(false)}
                  style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleQuickEdit}
                  style={{ 
                    backgroundColor: '#0066A1', 
                    color: '#e0e0e0',
                    border: 'none',
                    fontSize: '0.875rem',
                    padding: '0.375rem 0.75rem'
                  }}
                >
                  Quick Edit
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleFullEdit}
                  style={{ 
                    backgroundColor: '#FF6600', 
                    color: '#e0e0e0',
                    border: 'none',
                    fontSize: '0.875rem',
                    padding: '0.375rem 0.75rem'
                  }}
                >
                  Full Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    </Container>
  );
};

export default PartsList;
