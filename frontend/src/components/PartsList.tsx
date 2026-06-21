import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PRIMARY_ORANGE, COLOR_WARNING_BG, COLOR_WARNING_TEXT, COLOR_SUCCESS_BG, COLOR_SUCCESS_TEXT } from '../theme';
import {
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
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import * as XLSX from 'xlsx';
import axiosInstance from '../utils/axios';
import PartImageUpload from './PartImageUpload';
import RestockForm from './RestockForm';
import PartsUsageDialog from './PartsUsageDialog';
import ImportPartsDialog from './ImportPartsDialog';
import ReturnPartButton from './ReturnPartButton';
import ReturnPartsDialog from './ReturnPartsDialog';
import { Part } from '../types';
import DataTable, { ColumnDef } from './DataTable';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface BinLocation {
  location_id: number;
  name: string;
  part_count: number;
}

// PartsList specific interface - keeping it separate to avoid type conflicts
interface PartListItem {
  part_id: number;
  name: string;
  description?: string;
  manufacturer?: string;
  manufacturer_part_number?: string;
  quantity: number;
  minimum_quantity: number;
  location?: string;
  machine_name?: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  created_at?: string;
  updated_at?: string;
  last_ordered_date?: string;
  unit_cost?: number;
  status?: 'active' | 'discontinued';
  notes?: string;
  cost?: number; // Alternative cost field
  id?: number; // Alternative ID field
  [key: string]: any;
}

// DataTable requires a non-optional `id`; we derive it from part_id.
type PartRow = PartListItem & { id: number };

interface PartFormData {
  name: string;
  description: string;
  manufacturer: string;
  manufacturer_part_number: string;
  quantity: number | '';
  minimum_quantity: number | '';
  location: string;
  notes: string;
  unit_cost: number | '';
  status: 'active' | 'discontinued';
}

// Helper function to convert PartListItem to Part interface
const convertToPartInterface = (partListItem: PartListItem): Part => ({
  part_id: partListItem.part_id.toString(),
  name: partListItem.name,
  description: partListItem.description,
  manufacturer: partListItem.manufacturer,
  manufacturer_part_number: partListItem.manufacturer_part_number,
  quantity: partListItem.quantity,
  minimum_quantity: partListItem.minimum_quantity,
  location: partListItem.location,
  machine_name: partListItem.machine_name,
  stock_status: partListItem.stock_status || (partListItem.quantity <= partListItem.minimum_quantity ? 'low_stock' : 'in_stock'),
  created_at: partListItem.created_at || new Date().toISOString(),
  updated_at: partListItem.updated_at || new Date().toISOString()
});

const initialFormData: PartFormData = {
  name: '',
  description: '',
  manufacturer: '',
  manufacturer_part_number: '',
  quantity: '',
  minimum_quantity: '',
  location: '',
  notes: '',
  unit_cost: '',
  status: 'active'
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

const PartsList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Check if user can restock parts (admin and purchasing only)
  const canRestockParts = hasPermission('CAN_MANAGE_PURCHASE_ORDERS');
  
  const [parts, setParts] = useState<PartListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState<PartListItem | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openRestockForm, setOpenRestockForm] = useState(false);
  const [openUsageDialog, setOpenUsageDialog] = useState(false);
  const [openReturnDialog, setOpenReturnDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PartFormData>(initialFormData);
  const [isEditing, setIsEditing] = useState(false);

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<{ page: number; pageSize: number }>({
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
    'image_url', 'name', 'manufacturer_part_number', 'location', 
    'quantity'
  ]);

  // Add new state variables
  const [locations, setLocations] = useState<string[]>([]);
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);

  // Add state for suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<any[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState('');
  const [currentUnitCost, setCurrentUnitCost] = useState('');
  const [currentLeadTimeDays, setCurrentLeadTimeDays] = useState('');

  const [currentSupplierNotes, setCurrentSupplierNotes] = useState('');
  const [openEditConfirm, setOpenEditConfirm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<number | null>(null);
  
  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Column definitions for the DataTable. `key` doubles as the column id used
  // by the column-visibility menu and the `visibleColumns` filter below.
  const columnsWithActions: ColumnDef<PartRow>[] = [
    { key: 'part_id', label: 'ID' },
    {
      key: 'image_url',
      label: 'Image',
      sortable: false,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {row.image_url ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click
                setPreviewImage(row.image_url);
                setPreviewOpen(true);
              }}
              sx={{ p: 0.5 }}
            >
              <img
                src={row.image_url}
                alt="Part"
                style={{
                  width: 32,
                  height: 32,
                  objectFit: 'cover',
                  borderRadius: 4,
                  border: '1px solid #ddd'
                }}
              />
            </IconButton>
          ) : (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                // Open edit dialog to upload image
                handleOpenEdit(row);
              }}
              sx={{ p: 0.5, color: '#ccc' }}
            >
              <PhotoCameraIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )
    },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'manufacturer_part_number', label: 'Manufacturer Part #' },
    { key: 'location', label: 'Location' },
    { key: 'quantity', label: 'Quantity', align: 'right' },
    { key: 'minimum_quantity', label: 'Min Quantity', align: 'right' },
    {
      key: 'last_ordered_date',
      label: 'Last Ordered',
      render: (row) => (
        <span>{row.last_ordered_date ? new Date(row.last_ordered_date).toLocaleDateString() : ''}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Chip
          label={row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
          color={row.status === 'active' ? 'success' : 'error'}
          size="small"
        />
      )
    },
    {
      key: 'unit_cost',
      label: 'Cost',
      align: 'right',
      render: (row) => {
        const numValue = Number(row.unit_cost);
        return <span>{isNaN(numValue) ? '-' : `$${numValue.toFixed(2)}`}</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            data-testid="edit-button"
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
          >
            <EditIcon />
          </IconButton>
          {row.status !== 'discontinued' ? (
            <IconButton
              data-testid="delete-button"
              onClick={(e) => { e.stopPropagation(); handleDiscontinue(row); }}
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
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPart(row);
              setOpenReturnDialog(true);
            }}
            color="info"
            title="Return parts to inventory"
          >
            <UndoIcon />
          </IconButton>
        </Box>
      )
    }
  ];

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError(null); // Clear any previous errors
    
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
        const processedPart: PartListItem = {
          ...part,
          part_id: part.part_id,
          name: part.name || '',
          description: part.description || '',
          manufacturer: part.manufacturer || '',
          manufacturer_part_number: part.manufacturer_part_number || '',
          quantity: Number(part.quantity) || 0,
          minimum_quantity: Number(part.minimum_quantity) || 0,
          location: part.location !== null && part.location !== undefined ? String(part.location) : '',
          machine_name: part.machine_name,
          stock_status: part.stock_status || 'in_stock',
          created_at: part.created_at || '',
          updated_at: part.updated_at || '',
          unit_cost: Number(unitCostValue), 
          notes: part.notes || '',
          last_ordered_date: part.last_ordered_date || '',
          status: part.status || 'active',
          cost: part.cost || Number(unitCostValue),
          id: part.id
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
        sampleProcessed.forEach((part: PartListItem, i: number) => {
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
      
      setTotalItems(response.data.total || 0);
      setParts(updatedParts);
      setLoading(false);
      
      console.log(`✅ Successfully loaded ${updatedParts.length} parts in ${response.data.queryTime || 'unknown'}ms`);
    } catch (error: any) {
      console.error('Error fetching parts:', error);
      setError(`Failed to fetch parts: ${error.message || 'Unknown error'}`);
      setParts([]); // Clear parts on error to prevent stale data
      setTotalItems(0);
      setLoading(false);
    }
  }, [paginationModel, searchTerm]);

  // Effect to read URL search parameters when component mounts
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  // Single useEffect to fetch parts when dependencies change
  useEffect(() => {
    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      // Clear current parts before fetching new ones to prevent row ID conflicts
      if (searchTerm) {
        setParts([]);
      }
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

  const handleOpenEdit = (part: PartListItem) => {
    setFormData({
      name: part.name,
      description: part.description || '',
      manufacturer: part.manufacturer || '',
      manufacturer_part_number: part.manufacturer_part_number || '',
      quantity: part.quantity,
      minimum_quantity: part.minimum_quantity,
      location: part.location || '',
      notes: part.notes || '',
      unit_cost: part.unit_cost || 0,
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
        quantity: isNaN(Number(formData.quantity)) ? 0 : Number(formData.quantity),
        minimum_quantity: isNaN(Number(formData.minimum_quantity)) ? 0 : Number(formData.minimum_quantity),
        location: formData.location || '',
        notes: formData.notes || '',
        unit_cost: isNaN(Number(preferredSupplier?.unit_cost)) ? 0 : Number(preferredSupplier?.unit_cost),
        status: formData.status || 'active',
        supplier_id: Number(preferredSupplier?.supplier_id) || null
      };

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
          if (error.response?.data?.error?.includes('duplicate key value') ||
              error.response?.data?.error?.includes('unique')) {
            setError('A part with this manufacturer part number already exists. Please use a different value.');
          } else {
            setError(`Error saving part: ${error.response?.data?.error || error.message || 'Unknown error'}`);
          }
          
          throw error;
        }
      }

      if (response && response.status >= 200 && response.status < 300) {
        fetchParts();
        
        // If we were editing a part, refresh the selectedPart data to show updated info in details dialog
        if (isEditing && selectedPart) {
          try {
            const updatedPartResponse = await axiosInstance.get(`/api/v1/parts/${selectedPart.part_id}`);
            setSelectedPart(updatedPartResponse.data);
          } catch (refreshError) {
            console.error('Error refreshing part details:', refreshError);
            // Continue execution even if refresh fails
          }
        }
        
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

  const handleDiscontinue = async (part: PartListItem) => {
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

  // Fetch bin locations with occupancy counts
  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/parts/locations');
      const bins: BinLocation[] = response.data;
      setBinLocations(bins);
      setLocations(bins.map(b => b.name));
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add export function
  const handleExport = async () => {
    try {
      setExportLoading(true);
      // Fetch ALL parts without pagination by setting a very high limit
      const response = await axiosInstance.get('/api/v1/parts', {
        params: {
          limit: 999999, // Set a very high limit to get all parts
          page: 0
        }
      });
      let parts = response.data.items || response.data;

      console.log(`Fetched ${parts.length} parts for export`);

      // Filter parts by location if selected
      if (selectedLocation) {
        parts = parts.filter((part: PartListItem) => part.location === selectedLocation);
        console.log(`Filtered to ${parts.length} parts for location: ${selectedLocation}`);
      }

      // Check if there are parts to export
      if (!parts || parts.length === 0) {
        setError('No parts found to export');
        return;
      }

      // Transform data for export
      const exportData = parts.map((part: PartListItem) => ({
        'Name': part.name,
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
      setSuccess(`Inventory exported successfully! ${parts.length} parts exported to ${filename}`);
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

    // Validate unit cost - allow blank values (will default to 0)
    if (currentUnitCost && (isNaN(Number(currentUnitCost)) || Number(currentUnitCost) < 0)) {
      setError('Please enter a valid unit cost (must be 0 or greater)');
      return;
    }

    // Check if we're editing an existing supplier
    if (editingSupplier !== null) {
      const updatedSuppliers = selectedSuppliers.map(s => 
        s.supplier_id === editingSupplier 
          ? {
              ...s,
              unit_cost: Number(currentUnitCost) || 0,
              lead_time_days: currentLeadTimeDays ? Number(currentLeadTimeDays) : null,
              notes: currentSupplierNotes || ''
            }
          : s
      );
      setSelectedSuppliers(updatedSuppliers);
      
      // Reset editing state
      setEditingSupplier(null);
      setCurrentSupplierId('');
      setCurrentUnitCost('');
      setCurrentLeadTimeDays('');
      setCurrentSupplierNotes('');
      setError(null);
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

    // Create new supplier with valid numeric values
    const newSupplier = {
      supplier_id: Number(currentSupplierId),
      supplier_name: selectedSupplier.name,
      unit_cost: Number(currentUnitCost) || 0,
      is_preferred: selectedSuppliers.length === 0 ? true : false, // First supplier is preferred by default
      lead_time_days: currentLeadTimeDays ? Number(currentLeadTimeDays) : null,

      notes: currentSupplierNotes || ''
    };

    setSelectedSuppliers([...selectedSuppliers, newSupplier]);
    
    // Reset input fields
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays('');

    setCurrentSupplierNotes('');
    setError(null);
  };

  const handleEditSupplier = (supplierId: number) => {
    const supplier = selectedSuppliers.find(s => s.supplier_id === supplierId);
    if (supplier) {
      setEditingSupplier(supplierId);
      setCurrentSupplierId(supplierId.toString());
      setCurrentUnitCost(supplier.unit_cost?.toString() || '');
      setCurrentLeadTimeDays(supplier.lead_time_days?.toString() || '');
      setCurrentSupplierNotes(supplier.notes || '');
      setError(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingSupplier(null);
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays('');
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
    
    // If we're editing this supplier, cancel the edit
    if (editingSupplier === supplierId) {
      handleCancelEdit();
    }
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

  const handleRestock = () => {
    if (selectedPart) {
      // Pre-populate the restock form with the selected part
      setOpenRestockForm(true);
    }
    setOpenEditConfirm(false);
  };

  const handleCheckOut = () => {
    if (selectedPart) {
      // Open the usage dialog to check out the part
      setOpenUsageDialog(true);
    }
    setOpenEditConfirm(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 6, height: 40, bgcolor: PRIMARY_ORANGE, borderRadius: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Parts Inventory
        </Typography>
      </Box>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Filters */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Search by description, part number, or what it's used for…"
              value={searchTerm}
              onChange={handleSearch}
              sx={{ flexGrow: 1, minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: loading && searchTerm ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : undefined,
              }}
            />
            <Button
              variant="contained"
              onClick={handleOpenAdd}
              startIcon={<AddIcon />}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' }, fontWeight: 600 }}
            >
              Add Part
            </Button>
            <Button
              variant="contained"
              onClick={() => canRestockParts && setOpenRestockForm(true)}
              disabled={!canRestockParts}
              title={canRestockParts ? 'Restock parts' : 'Only admin and purchasing users can restock parts'}
              startIcon={<AddCircleIcon sx={{ fontSize: 18 }} />}
              sx={{ backgroundColor: canRestockParts ? PRIMARY_ORANGE : '#6c757d', '&:hover': { backgroundColor: canRestockParts ? '#e65c00' : '#5a6268' } }}
            >
              Restock
            </Button>
            <Button
              variant="contained"
              onClick={() => setOpenUsageDialog(true)}
              startIcon={<RemoveCircleIcon sx={{ fontSize: 18 }} />}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
            >
              Check Out
            </Button>
            <Button
              variant="contained"
              onClick={() => setOpenReturnDialog(true)}
              startIcon={<UndoIcon sx={{ fontSize: 18 }} />}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
            >
              Return Parts
            </Button>
            <Button
              variant="contained"
              onClick={() => setImportDialogOpen(true)}
              startIcon={<CloudUploadIcon sx={{ fontSize: 18 }} />}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
            >
              Import
            </Button>
            <Button
              variant="contained"
              onClick={() => setExportDialogOpen(true)}
              startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
            >
              Export
            </Button>
            <Button
              variant="contained"
              title="Show/hide columns"
              onClick={(e) => setColumnVisibilityMenuAnchor(e.currentTarget)}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' }, minWidth: 'auto', px: 1 }}
            >
              <ViewColumnIcon sx={{ fontSize: 18 }} />
            </Button>
          </Box>
        </Paper>

        {/* Column Visibility Menu */}
        <Menu
          anchorEl={columnVisibilityMenuAnchor}
          open={Boolean(columnVisibilityMenuAnchor)}
          onClose={() => setColumnVisibilityMenuAnchor(null)}
        >
          {columnsWithActions.map((column) => (
            <MenuItem
              key={String(column.key)}
              onClick={() => handleColumnVisibilityChange(String(column.key))}
            >
              <Checkbox
                checked={visibleColumns.includes(String(column.key))}
                onChange={() => {}}
              />
              {column.label}
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
          <Box sx={{ width: '100%', maxHeight: 650, overflow: 'auto' }}>
            {loading && parts.length === 0 && (
              <LinearProgress sx={{ height: '3px', '& .MuiLinearProgress-bar': { backgroundColor: PRIMARY_ORANGE } }} />
            )}
            <DataTable<PartRow>
              columns={columnsWithActions.filter(col => visibleColumns.includes(String(col.key)))}
              rows={parts.map(p => ({ ...p, id: p.part_id ?? p.id ?? 0 })) as PartRow[]}
              pagination={false}
              onRowClick={(row) => {
                setSelectedPart(row);
                setOpenEditConfirm(true);
                setError(null);
              }}
              emptyMessage={error || 'No parts found'}
              rowSx={(row) =>
                row.quantity <= row.minimum_quantity
                  ? { bgcolor: 'rgba(255, 77, 79, 0.08)' }
                  : {}
              }
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
          <Box display="flex" alignItems="center">
            <Typography variant="body2" sx={{ color: '#495057', mr: 2, fontWeight: 500 }}>
              Total: {totalItems} parts
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ color: '#495057' }}>
                Rows per page:
              </Typography>
              <TextField
                select
                size="small"
                value={paginationModel.pageSize}
                onChange={(e) => {
                  setPaginationModel({
                    ...paginationModel,
                    pageSize: Number(e.target.value),
                    page: 0
                  });
                }}
                sx={{ width: 80 }}
                SelectProps={{ native: true }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </TextField>
            </Box>
          </Box>
          
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
                background: PRIMARY_ORANGE,
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
      <Dialog
        open={!!selectedPart && !openDialog}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '0.75rem' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
          Part Details
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedPart && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f9fc', borderColor: '#d9e6ef' }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Basic Information</Typography>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Part Name</Typography>
                    <Typography variant="body2">{selectedPart.name}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Manufacturer</Typography>
                    <Typography variant="body2">{selectedPart.manufacturer || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Manufacturer Part #</Typography>
                    <Typography variant="body2">{selectedPart.manufacturer_part_number || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box>
                      <Chip
                        label={selectedPart.status === 'active' ? 'Active' : 'Discontinued'}
                        color={selectedPart.status === 'active' ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f9fc', borderColor: '#d9e6ef' }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Inventory Details</Typography>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Quantity</Typography>
                    <Typography variant="body2">{selectedPart.quantity}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Minimum Quantity</Typography>
                    <Typography variant="body2">{selectedPart.minimum_quantity}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    <Typography variant="body2">{selectedPart.location || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Unit Cost</Typography>
                    <Typography variant="body2">
                      ${typeof selectedPart.unit_cost === 'number'
                        ? selectedPart.unit_cost.toFixed(2)
                        : Number(selectedPart.unit_cost || 0).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Stock Status</Typography>
                    <Box>
                      <Chip
                        label={
                          selectedPart.quantity === 0
                            ? 'Out of Stock'
                            : selectedPart.quantity <= selectedPart.minimum_quantity
                              ? 'Low Stock'
                              : 'In Stock'
                        }
                        color={
                          selectedPart.quantity === 0
                            ? 'error'
                            : selectedPart.quantity <= selectedPart.minimum_quantity
                              ? 'warning'
                              : 'success'
                        }
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {selectedPart.description && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f9fc', borderColor: '#d9e6ef' }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Description</Typography>
                    <Typography variant="body2">{selectedPart.description}</Typography>
                  </Paper>
                </Grid>
              )}

              {selectedPart.notes && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f9fc', borderColor: '#d9e6ef' }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Notes</Typography>
                    <Typography variant="body2">{selectedPart.notes}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCloseDetails} size="small">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Part Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '0.75rem', maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
          {isEditing ? 'Edit Part' : 'Add Part'}
        </DialogTitle>
        <form onSubmit={handleSubmit} noValidate>
          <DialogContent sx={{ pt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name *"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Manufacturer"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Manufacturer Part #"
                  name="manufacturer_part_number"
                  value={formData.manufacturer_part_number}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Quantity *"
                  name="quantity"
                  inputProps={{ min: 0 }}
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Minimum Quantity *"
                  name="minimum_quantity"
                  inputProps={{ min: 0 }}
                  value={formData.minimum_quantity}
                  onChange={handleInputChange}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6} ref={locationRef} sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Location"
                  name="location"
                  autoComplete="off"
                  placeholder="Type or select a bin..."
                  value={formData.location}
                  onChange={(e) => { handleInputChange(e); setShowLocationDropdown(true); }}
                  onFocus={() => setShowLocationDropdown(true)}
                />
                {showLocationDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
                    maxHeight: '200px', overflowY: 'auto',
                    border: '1px solid rgba(0,0,0,0.12)', borderRadius: '0 0 4px 4px',
                    backgroundColor: '#fff', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                  }}>
                    {binLocations
                      .filter(loc => loc.name.toLowerCase().includes(formData.location.toLowerCase()))
                      .map(loc => (
                        <div
                          key={loc.location_id}
                          onMouseDown={() => {
                            handleInputChange({ target: { name: 'location', value: loc.name } } as any);
                            setShowLocationDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
                        >
                          <span>{loc.name}</span>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                            backgroundColor: loc.part_count > 0 ? COLOR_WARNING_BG : COLOR_SUCCESS_BG,
                            color: loc.part_count > 0 ? COLOR_WARNING_TEXT : COLOR_SUCCESS_TEXT
                          }}>
                            {loc.part_count > 0 ? `${loc.part_count} part${loc.part_count !== 1 ? 's' : ''}` : 'Available'}
                          </span>
                        </div>
                      ))}
                    {binLocations.filter(loc => loc.name.toLowerCase().includes(formData.location.toLowerCase())).length === 0 && formData.location && (
                      <div style={{ padding: '8px 12px', color: '#6c757d', fontSize: '0.875rem' }}>
                        New location: <strong>"{formData.location}"</strong> will be created
                      </div>
                    )}
                  </div>
                )}
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                />
              </Grid>

              {/* Part Image Upload Section */}
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1, overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1, backgroundColor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography component="span" fontWeight={600}>Upload Part Image</Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    {isEditing && selectedPart?.part_id ? (
                      <PartImageUpload
                        partId={selectedPart.part_id}
                        currentImageUrl={selectedPart.image_url}
                        onImageUpdate={(imageUrl) => {
                          if (selectedPart) {
                            setSelectedPart({ ...selectedPart, image_url: imageUrl });
                            setParts(parts.map(p =>
                              p.part_id === selectedPart.part_id
                                ? { ...p, image_url: imageUrl }
                                : p
                            ));
                          }
                        }}
                      />
                    ) : (
                      <Alert severity="info" sx={{ mb: 0 }}>
                        <small>
                          <strong>Note:</strong> Save the part first, then you can upload an image.
                        </small>
                      </Alert>
                    )}
                  </Box>
                </Box>
              </Grid>

              {/* Suppliers Section */}
              <Grid item xs={12}>
                <Box sx={{ mt: 1, mb: 0.5 }}>
                  <Typography variant="h6" color="primary" sx={{ mb: 1 }}>Part Suppliers</Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <small><strong>Important:</strong> Add one or more suppliers for this part. The first supplier added will be set as preferred.</small>
                  </Alert>

                  {/* Add Supplier Form */}
                  <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                    <Box sx={{ px: 2, py: 1, backgroundColor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography component="span" fontWeight={600}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Supplier *"
                            value={currentSupplierId}
                            onChange={(e) => setCurrentSupplierId(e.target.value)}
                            disabled={editingSupplier !== null}
                            SelectProps={{ native: true }}
                          >
                            <option value="">Select a supplier</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.supplier_id} value={supplier.supplier_id}>
                                {supplier.name}
                              </option>
                            ))}
                          </TextField>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Unit Cost ($)"
                            value={currentUnitCost}
                            onChange={(e) => setCurrentUnitCost(e.target.value)}
                            placeholder="Leave blank for $0.00"
                            inputProps={{ step: 0.01, min: 0 }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Lead Time (Days)"
                            value={currentLeadTimeDays}
                            onChange={(e) => setCurrentLeadTimeDays(e.target.value)}
                            inputProps={{ min: 0 }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={8}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Notes"
                            value={currentSupplierNotes}
                            onChange={(e) => setCurrentSupplierNotes(e.target.value)}
                            multiline
                            rows={3}
                          />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', pb: 0.5 }}>
                            <Button
                              type="button"
                              variant="contained"
                              onClick={handleAddSupplier}
                              sx={{ flexGrow: 1, backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' }, fontSize: '0.875rem' }}
                            >
                              {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                            </Button>
                            {editingSupplier && (
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={handleCancelEdit}
                                sx={{ fontSize: '0.875rem' }}
                              >
                                Cancel
                              </Button>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>

                  {/* Supplier List */}
                  {selectedSuppliers.length > 0 ? (
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                          <tr>
                            {['Supplier', 'Unit Cost', 'Lead Time', 'Min Order', 'Preferred', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.12)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSuppliers.map((supplier, idx) => (
                            <tr key={supplier.supplier_id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : 'rgba(0,0,0,0.04)' }}>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>{getSupplierName(supplier.supplier_id)}</td>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>${typeof supplier.unit_cost === 'number'
                                  ? supplier.unit_cost.toFixed(2)
                                  : Number(supplier.unit_cost || 0).toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>{supplier.lead_time_days || '-'}</td>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>{supplier.minimum_order_quantity || '-'}</td>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                                <input
                                  type="radio"
                                  checked={supplier.is_preferred}
                                  onChange={() => handleSetPreferred(supplier.supplier_id)}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                                <Button
                                  type="button"
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  onClick={() => handleEditSupplier(supplier.supplier_id)}
                                  sx={{ fontSize: '0.75rem', mr: 0.5 }}
                                  disabled={editingSupplier === supplier.supplier_id}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleRemoveSupplier(supplier.supplier_id)}
                                  sx={{ fontSize: '0.75rem' }}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  ) : (
                    <Alert severity="warning">
                      <strong>No suppliers added yet.</strong> You must add at least one supplier for this part.
                    </Alert>
                  )}
                </Box>
              </Grid>

              <input
                type="hidden"
                name="status"
                value={formData.status}
              />
            </Grid>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => setOpenDialog(false)}
              size="small"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              size="small"
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
            >
              {loading ? 'Saving...' : isEditing ? 'Update Part' : 'Add Part'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Restock Form Dialog */}
      <RestockForm
        open={openRestockForm}
        onClose={() => setOpenRestockForm(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts restocked successfully');
        }}
        preSelectedPart={selectedPart ? convertToPartInterface(selectedPart) : null}
      />

      {/* Parts Usage Dialog */}
      <PartsUsageDialog
        open={openUsageDialog}
        onClose={() => setOpenUsageDialog(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts checked out successfully');
        }}
        preSelectedPart={selectedPart ? convertToPartInterface(selectedPart) : null}
      />

      {/* Return Parts Dialog */}
      <ReturnPartsDialog
        open={openReturnDialog}
        onClose={() => setOpenReturnDialog(false)}
        onSuccess={() => {
          fetchParts();
          setSuccess('Parts returned to inventory successfully');
        }}
        preSelectedPart={selectedPart ? {
          part_id: selectedPart.part_id.toString(),
          name: selectedPart.name,
          description: selectedPart.description,
          manufacturer: selectedPart.manufacturer,
          manufacturer_part_number: selectedPart.manufacturer_part_number,
          quantity: selectedPart.quantity,
          minimum_quantity: selectedPart.minimum_quantity,
          location: selectedPart.location,
          machine_name: selectedPart.machine_name,
          stock_status: selectedPart.stock_status || (selectedPart.quantity <= selectedPart.minimum_quantity ? 'low_stock' as const : 'in_stock' as const),
          created_at: selectedPart.created_at || new Date().toISOString(),
          updated_at: selectedPart.updated_at || new Date().toISOString()
        } : null}
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
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '0.75rem' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
          Export Inventory
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Select a location to filter the export, or leave empty to export all inventory items.
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label="Location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => setExportDialogOpen(false)}
            size="small"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={handleExport}
            disabled={exportLoading}
            size="small"
            startIcon={exportLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
            sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
          >
            {exportLoading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!(error || success)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={5000}
        onClose={() => { setError(null); setSuccess(null); }}
      >
        <Alert
          severity={error ? 'error' : 'success'}
          onClose={() => { setError(null); setSuccess(null); }}
          sx={{ minWidth: '300px' }}
        >
          {error || success}
        </Alert>
      </Snackbar>

      {/* Part Edit Confirmation Dialog */}
      <Dialog
        open={openEditConfirm}
        onClose={() => setOpenEditConfirm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '0.75rem' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider' }}>
          Part Actions
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>What would you like to do with this part?</Typography>
          <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Selected Part: {selectedPart?.name}
            </Typography>
            <Typography variant="body2" gutterBottom>
              Mfg Part #: {selectedPart?.manufacturer_part_number || 'N/A'}
            </Typography>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Current Stock: {selectedPart?.quantity}
              </Typography>
              <Chip
                label={(selectedPart?.quantity || 0) <= (selectedPart?.minimum_quantity || 0) ? 'Low Stock' : 'In Stock'}
                color={(selectedPart?.quantity || 0) <= (selectedPart?.minimum_quantity || 0) ? 'warning' : 'success'}
                size="small"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => setOpenEditConfirm(false)}
            size="small"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => {
              if (selectedPart) {
                handleOpenEdit(selectedPart);
              }
              setOpenEditConfirm(false);
            }}
            size="small"
            sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#115293' } }}
          >
            Edit Part
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={handleRestock}
            size="small"
            color="success"
          >
            Restock
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={handleCheckOut}
            size="small"
            sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e65c00' } }}
          >
            Check Out
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => {
              if (selectedPart) {
                setOpenReturnDialog(true);
              }
              setOpenEditConfirm(false);
            }}
            size="small"
            sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#115293' } }}
            startIcon={<UndoIcon sx={{ fontSize: 16 }} />}
          >
            Return Part
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Part Image Preview
          <IconButton
            sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={() => setPreviewOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Part" 
              style={{ 
                width: '100%', 
                maxWidth: '600px',
                height: 'auto',
                borderRadius: 8
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PartsList;
