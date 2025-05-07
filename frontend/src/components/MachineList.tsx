import React, { useEffect, useState, useRef } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Container,
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
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Build as BuildIcon,
  CalendarToday as CalendarIcon,
  Add as AddIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import axios from '../utils/axios';
import MachineDialogs from './MachineDialogs';
import { Link } from 'react-router-dom';
import mockMachines from '../mockData/machines';
import { Machine } from '../types';

interface MachineListProps {
  machinesData?: Machine[];
}

const MachineList: React.FC<MachineListProps> = ({ machinesData }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [newMachine, setNewMachine] = useState({
    name: '',
    model: '',
    serial_number: '',
    location: '',
    manufacturer: '',
    installation_date: '',
    last_maintenance_date: null as string | null,
    next_maintenance_date: '',
    notes: '',
    status: 'active'
  });
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');

  useEffect(() => {
    if (machinesData) {
      setMachines(machinesData);
    } else {
      fetchMachines();
    }
  }, [machinesData]);

  const fetchMachines = async () => {
    try {
      // For development, use mock data instead of API call
      setMachines(mockMachines);
      
      // When ready to connect to real API, uncomment this:
      // const response = await axios.get('/api/v1/machines');
      // setMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch machines',
        severity: 'error',
      });
    }
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
      last_maintenance_date: null,
      next_maintenance_date: '',
      notes: '',
      status: 'active'
    });
    // Return focus to the add button
    if (addButtonRef.current) {
      addButtonRef.current.focus();
    }
  };

  const handleEditOpen = (machine: Machine) => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Ensure we have a valid number for the ID
    if (!machine.id && !machine.machine_id) {
      console.error('No valid machine ID found');
      return;
    }
    setSelectedMachine({
      ...machine,
      id: Number(machine.id || machine.machine_id),  // Convert to number explicitly
      installation_date: machine.installation_date?.split('T')[0] || '',
      last_maintenance_date: machine.last_maintenance_date?.split('T')[0] || '',
      next_maintenance_date: machine.next_maintenance_date?.split('T')[0] || '',
      location: machine.location || '',
      manufacturer: machine.manufacturer || '',
      notes: machine.notes || '',
      status: machine.status || 'active'
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

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (selectedMachine) {
      setSelectedMachine({
        ...selectedMachine,
        [name]: value,
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
        last_maintenance_date: selectedMachine.last_maintenance_date ? new Date(selectedMachine.last_maintenance_date).toISOString() : null,
        next_maintenance_date: selectedMachine.next_maintenance_date ? new Date(selectedMachine.next_maintenance_date).toISOString() : null,
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
      fetchMachines();
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

  const getMaintenanceStatus = (nextMaintenanceDate: string) => {
    if (!nextMaintenanceDate) return { label: 'No Schedule', color: 'default' as const };
    const today = new Date();
    const maintenance = new Date(nextMaintenanceDate);
    const diffDays = Math.ceil((maintenance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Overdue', color: 'error' as const };
    if (diffDays <= 7) return { label: 'Due Soon', color: 'warning' as const };
    return { label: 'Scheduled', color: 'success' as const };
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 500 }}>
            Machines
          </Typography>
          {machines.length > 0 && (
            <Chip 
              label={`${machines.length} total`} 
              color="primary" 
              size="small"
              sx={{ ml: 2 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            component={Link}
            to="costs"
            startIcon={<BarChartIcon />}
            aria-label="View Machine Costs"
          >
            Machine Costs
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpen}
            ref={addButtonRef}
            startIcon={<AddIcon />}
            aria-label="Add New Machine"
          >
            Add New Machine
          </Button>
        </Box>
      </Box>

      <Paper elevation={2}>
        {/* Zero state for no machines */}
        {machines.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No machines found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {selectedManufacturer !== 'all' ? 
                `No machines found for manufacturer "${selectedManufacturer}".` : 
                "Add your first machine to get started."}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpen}
              startIcon={<AddIcon />}
            >
              Add New Machine
            </Button>
          </Box>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {machines.map((machine, index) => (
              <React.Fragment key={machine.id}>
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
                          <Chip 
                            label={getMaintenanceStatus(machine.next_maintenance_date).label}
                            color={getMaintenanceStatus(machine.next_maintenance_date).color}
                            size="small"
                            sx={{ ml: 2 }}
                          />
                        </Box>
                        
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
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
                        
                        <Box sx={{ display: 'flex', gap: 3, color: 'text.secondary', fontSize: '0.875rem', mt: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <BuildIcon sx={{ mr: 1, fontSize: '1rem', color: 'warning.main' }} />
                            Last Maintenance: {formatDate(machine.last_maintenance_date) || 'Not Available'}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CalendarIcon sx={{ mr: 1, fontSize: '1rem', color: 'info.main' }} />
                            Next Maintenance: {formatDate(machine.next_maintenance_date) || 'Not Scheduled'}
                          </Box>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditOpen(machine)}
                        aria-label={`Edit ${machine.name}`}
                        sx={{ minWidth: '100px' }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteMachine(machine.id)}
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
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MachineList;
