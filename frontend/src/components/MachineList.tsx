import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PRIMARY_ORANGE } from '../theme';
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Box,
  Chip,
  Divider,
  Paper,
  Grid,
  Badge,
  InputAdornment,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Build as BuildIcon,
  CalendarToday as CalendarIcon,
  Add as AddIcon,
  BarChart as BarChartIcon,
  Description as DocumentIcon,
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import axios from '../utils/axios';
import MachineDialogs from './MachineDialogs';
import { Link } from 'react-router-dom';
import { Machine } from '../types';
import { getMachineDocuments } from '../services/machineDocumentsApi';

interface MachineListProps {
  machinesData?: Machine[];
}

// Custom CSS styles for app branding
const AppStyles = `
  .text-primary {
    color: ${PRIMARY_ORANGE} !important;
  }

  .bg-primary {
    background-color: ${PRIMARY_ORANGE} !important;
  }

  .form-check-input:checked {
    background-color: ${PRIMARY_ORANGE};
    border-color: ${PRIMARY_ORANGE};
  }

  .border-primary {
    border-color: ${PRIMARY_ORANGE} !important;
  }

  a {
    color: ${PRIMARY_ORANGE};
  }

  a:hover {
    color: #e65c00;
  }
`;

const MachineList: React.FC<MachineListProps> = ({ machinesData }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [documentCounts, setDocumentCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [newMachine, setNewMachine] = useState({
    name: '',
    model: '',
    serial_number: '',
    location: '',
    manufacturer: '',
    installation_date: '',
    notes: '',
    status: 'active',
    compatible_die_types: [] as string[]
  });
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');

  useEffect(() => {
    if (machinesData) {
      setMachines(machinesData);
      setFilteredMachines(machinesData);
      setLoading(false);
    } else {
      fetchMachines();
    }
  }, [machinesData]);

  // Effect for filtering machines based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredMachines(machines);
    } else {
      const filtered = machines.filter(machine =>
        machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        machine.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        machine.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        machine.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        machine.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMachines(filtered);
    }
  }, [machines, searchTerm]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/v1/machines');
      setMachines(response.data);
      setFilteredMachines(response.data);
      // Fetch document counts for all machines
      fetchDocumentCounts(response.data);
      fetchLocations(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setError('Failed to fetch machines');
      setSnackbar({
        open: true,
        message: 'Failed to fetch machines',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = (machineList: Machine[]) => {
    const uniqueLocations = Array.from(
      new Set(machineList.map(machine => machine.location).filter(Boolean))
    ).filter((loc): loc is string => typeof loc === 'string');
    setLocations(uniqueLocations);
  };

  const fetchDocumentCounts = async (machineList: Machine[]) => {
    const counts: Record<number, number> = {};
    
    for (const machine of machineList) {
      try {
        const machineId = machine.id || machine.machine_id;
        if (machineId) {
          const response = await getMachineDocuments(machineId);
          counts[machineId] = response.data.length;
        }
      } catch (error) {
        console.log(`No documents found for machine ${machine.name}`);
        counts[machine.id || machine.machine_id || 0] = 0;
      }
    }
    
    setDocumentCounts(counts);
  };

  const handleOpen = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNewMachine({
      name: '',
      model: '',
      serial_number: '',
      location: '',
      manufacturer: '',
      installation_date: '',
      notes: '',
      status: 'active',
      compatible_die_types: []
    });
    // Return focus to the add button
    if (addButtonRef.current) {
      addButtonRef.current.focus();
    }
  };

  const handleEditOpen = (machine: Machine) => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Ensure we have a valid number for the ID
    if (!machine.machine_id && !machine.id) {
      console.error('No valid machine ID found');
      return;
    }
    setSelectedMachine({
      ...machine,
      id: Number(machine.machine_id || machine.id),  // Convert to number explicitly
      installation_date: machine.installation_date?.split('T')[0] || '',
      location: machine.location || '',
      manufacturer: machine.manufacturer || '',
      notes: machine.notes || '',
      status: machine.status || 'active',
      compatible_die_types: machine.compatible_die_types || []
    });
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedMachine(null);
    // Return focus to the previously focused element
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewMachine(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSelectedMachine(prev => prev ? {
      ...prev,
      [name]: value,
    } : null);
  };

  const handleDieTypeChange = (dieType: string, checked: boolean, isEdit: boolean) => {
    if (isEdit) {
      setSelectedMachine(prev => {
        if (!prev) return null;
        const currentTypes = prev.compatible_die_types || [];
        const newTypes = checked
          ? [...currentTypes, dieType]
          : currentTypes.filter(t => t !== dieType);
        return { ...prev, compatible_die_types: newTypes };
      });
    } else {
      setNewMachine(prev => {
        const currentTypes = prev.compatible_die_types || [];
        const newTypes = checked
          ? [...currentTypes, dieType]
          : currentTypes.filter(t => t !== dieType);
        return { ...prev, compatible_die_types: newTypes };
      });
    }
  };

  const handleAddMachine = async () => {
    try {
      await axios.post('/api/v1/machines', newMachine);
      handleClose();
      fetchMachines();
      setSnackbar({
        open: true,
        message: 'Machine added successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error adding machine:', error);
      setSnackbar({
        open: true,
        message: 'Failed to add machine',
        severity: 'error',
      });
    }
  };

  const handleUpdateMachine = async () => {
    if (!selectedMachine) return;
    
    // Get the correct ID (either id or machine_id)
    const machineId = selectedMachine.id || selectedMachine.machine_id;
    
    if (!machineId) {
      setSnackbar({
        open: true,
        message: 'Invalid machine ID',
        severity: 'error',
      });
      return;
    }

    try {
      // Format dates properly for the API
      const formattedMachine = {
        ...selectedMachine,
        installation_date: selectedMachine.installation_date ? new Date(selectedMachine.installation_date).toISOString() : null,
        // Ensure other fields are properly formatted
        name: selectedMachine.name || '',
        model: selectedMachine.model || '',
        serial_number: selectedMachine.serial_number || '',
        location: selectedMachine.location || null,
        manufacturer: selectedMachine.manufacturer || null,
        notes: selectedMachine.notes || null,
        status: selectedMachine.status || 'active'
      };

      console.log('Updating machine with data:', formattedMachine);
      console.log('Machine ID:', machineId);
      
      await axios.put(`/api/v1/machines/${machineId}`, formattedMachine);
      handleEditClose();
      fetchMachines(); // This will also refresh document counts
      setSnackbar({
        open: true,
        message: 'Machine updated successfully',
        severity: 'success',
      });
    } catch (error: any) {
      console.error('Error updating machine:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to update machine',
        severity: 'error',
      });
    }
  };

  const handleDeleteMachine = async (id: number | undefined) => {
    if (!id) {
      setSnackbar({
        open: true,
        message: 'Cannot delete machine: Invalid ID',
        severity: 'error',
      });
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this machine?')) return;
    try {
      await axios.delete(`/api/v1/machines/${id}`);
      fetchMachines();
      setSnackbar({
        open: true,
        message: 'Machine deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting machine:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete machine',
        severity: 'error',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Add export function
  const handleExport = async () => {
    try {
      setExportLoading(true);
      let machinesToExport = machines;

      // Filter machines by location if selected
      if (selectedLocation) {
        machinesToExport = machines.filter(machine => machine.location === selectedLocation);
      }

      // Transform data for export
      const exportData = machinesToExport.map((machine: Machine) => ({
        'Machine Name': machine.name,
        'Model': machine.model || '',
        'Serial Number': machine.serial_number || '',
        'Manufacturer': machine.manufacturer || '',
        'Location': machine.location || '',
        'Status': machine.status || 'active',
        'Installation Date': machine.installation_date ? new Date(machine.installation_date).toLocaleDateString() : 'N/A',
        'Notes': machine.notes || ''
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Machine Name
        { wch: 20 }, // Model
        { wch: 20 }, // Serial Number
        { wch: 20 }, // Manufacturer
        { wch: 15 }, // Location
        { wch: 10 }, // Status
        { wch: 15 }, // Installation Date
        { wch: 40 }, // Notes
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Machines');
      
      // Generate filename with location if selected
      const filename = selectedLocation 
        ? `machines_${selectedLocation.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `machines_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Machines exported successfully!');
    } catch (error: any) {
      console.error('Error exporting machines:', error);
      setError('Failed to export machines');
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
      setSelectedLocation('');
    }
  };


  return (
    <Box sx={{ p: 3 }}>
      {/* Apply app brand styling */}
      <style>{AppStyles}</style>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 6, height: 40, bgcolor: PRIMARY_ORANGE, borderRadius: 1 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Machine Management
        </Typography>
      </Box>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Actions */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search by name, model, serial number, location, or manufacturer..."
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
            
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={handleOpen}
                  ref={addButtonRef}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: PRIMARY_ORANGE, 
                    borderColor: PRIMARY_ORANGE,
                    '&:hover': { backgroundColor: '#e65c00' },
                    minWidth: '140px'
                  }}
                >
                  Add Machine
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setExportDialogOpen(true)}
                  startIcon={<DownloadIcon />}
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
                  Export
                </Button>
                <Button
                  variant="outlined"
                  component={Link}
                  to="costs"
                  startIcon={<BarChartIcon />}
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
                  Costs
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Statistics row */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Chip 
              label={`${filteredMachines.length} machines showing`} 
              color="primary" 
              variant="outlined"
              sx={{ 
                borderColor: PRIMARY_ORANGE,
                color: PRIMARY_ORANGE,
                backgroundColor: 'rgba(255, 102, 0, 0.04)'
              }}
            />
            <Chip 
              label={`${machines.length} total machines`} 
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
        </Paper>

        {/* Machines List */}
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
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress sx={{ color: PRIMARY_ORANGE }} />
              <Typography variant="body1" sx={{ mt: 2 }}>Loading machines...</Typography>
            </Box>
          ) : filteredMachines.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchTerm ? 'No machines match your search' : 'No machines found'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm ? 
                  `Try adjusting your search terms or clear the search to see all machines.` :
                  selectedManufacturer !== 'all' ? 
                    `No machines found for manufacturer "${selectedManufacturer}".` : 
                    "Add your first machine to get started."}
              </Typography>
              {!searchTerm && (
                <Button
                  variant="contained"
                  onClick={handleOpen}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: PRIMARY_ORANGE,
                    '&:hover': { backgroundColor: '#e65c00' }
                  }}
                >
                  Add New Machine
                </Button>
              )}
            </Box>
          ) : (
            <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
              {filteredMachines.map((machine, index) => (
              <React.Fragment key={machine.machine_id || machine.id || `machine-${index}`}>
                {index > 0 && <Divider component="li" />}
                <ListItem
                  sx={{
                    py: 2,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={9}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6" component="div">
                            {machine.name}
                          </Typography>
                        </Box>
                        
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }} component="div">
                          {machine.model}
                          {machine.manufacturer && (
                            <>
                              {' - '}
                              <Chip
                                label={machine.manufacturer}
                                size="small"
                                variant="outlined"
                              />
                            </>
                          )}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 3, color: 'text.secondary', fontSize: '0.875rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                            <Typography variant="body2" color="text.secondary">
                              {machine.location || 'Location not specified'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>S/N:</strong> {machine.serial_number || 'Not Available'}
                            </Typography>
                          </Box>
                        </Box>
                        
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Badge 
                        badgeContent={documentCounts[machine.machine_id || machine.id || 0] || 0} 
                        color="primary"
                        sx={{ mr: 1 }}
                      >
                        <Tooltip title={`${documentCounts[machine.machine_id || machine.id || 0] || 0} documents`}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditOpen(machine)}
                            aria-label={`View documents for ${machine.name}`}
                          >
                            <DocumentIcon />
                          </IconButton>
                        </Tooltip>
                      </Badge>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditOpen(machine)}
                        aria-label={`Edit ${machine.name}`}
                        sx={{ 
                          minWidth: '100px',
                          borderColor: PRIMARY_ORANGE,
                          color: PRIMARY_ORANGE,
                          '&:hover': { 
                            borderColor: '#e65c00',
                            backgroundColor: 'rgba(255, 102, 0, 0.04)'
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteMachine(machine.machine_id || machine.id)}
                        aria-label={`Delete ${machine.name}`}
                        sx={{ minWidth: '100px' }}
                      >
                        Delete
                      </Button>
                    </Grid>
                  </Grid>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Machine Dialogs */}
      <MachineDialogs
        open={open}
        editOpen={editOpen}
        newMachine={newMachine as Partial<Machine>}
        selectedMachine={selectedMachine as any}
        onClose={handleClose}
        onEditClose={handleEditClose}
        onInputChange={handleInputChange}
        onEditInputChange={handleEditInputChange}
        onAddMachine={handleAddMachine}
        onUpdateMachine={handleUpdateMachine}
        onDieTypeChange={handleDieTypeChange}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ 
            width: '100%',
            borderRadius: '0.75rem',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Export Dialog */}
      {exportDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
          onClick={() => setExportDialogOpen(false)}
        >
          <Paper
            sx={{
              p: 4,
              borderRadius: '0.75rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
              Export Machines
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3 }}>
              Select a location to filter the export, or leave empty to export all machines.
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Location</Typography>
              <TextField
                select
                fullWidth
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                SelectProps={{
                  native: true,
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
              >
                <option value="">All Locations</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </TextField>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setExportDialogOpen(false)}
                sx={{ 
                  borderColor: '#ccc',
                  color: '#666',
                  '&:hover': { 
                    borderColor: '#999',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleExport}
                disabled={exportLoading}
                startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                sx={{ 
                  backgroundColor: PRIMARY_ORANGE,
                  '&:hover': { backgroundColor: '#e65c00' }
                }}
              >
                {exportLoading ? 'Exporting...' : 'Export'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

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
      </Box>
    </Box>
  );
};

export default MachineList;
