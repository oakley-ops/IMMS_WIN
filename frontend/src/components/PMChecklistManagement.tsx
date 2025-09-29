import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  CircularProgress,
  Box,
  Typography,
  IconButton,
  Alert,
  Container,
  Grid,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { 
  DataGrid, 
  GridColDef, 
  GridRenderCellParams,
  GridPaginationModel,
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import axiosInstance from '../utils/axios';
import PMCalendar, { PMCalendarRef } from './PMCalendar';

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

interface PMChecklist {
  checklist_id: number;
  name: string;
  description: string;
  machine_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tasks?: PMTask[];
}

interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  machine_type: string;
  location: string;
  manufacturer: string;
  installation_date?: string;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string;
  notes?: string;
  status?: string;
}

interface PMTask {
  task_id?: number;
  task_name: string;
  task_description: string;
  is_required: boolean;
  order_position: number;
}

interface Technician {
  technician_id: number;
  name: string;
  active: boolean;
}

const PMChecklistManagement: React.FC = () => {
  const [checklists, setChecklists] = useState<PMChecklist[]>([]);
  const [filteredChecklists, setFilteredChecklists] = useState<PMChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<PMChecklist | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<PMChecklist | null>(null);
  const [showTasks, setShowTasks] = useState<{ [key: number]: boolean }>({});
  const [activeTab, setActiveTab] = useState(1);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedMachineForSchedule, setSelectedMachineForSchedule] = useState<Machine | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    machine_id: '',
    machine_type: '',
    tasks: [] as PMTask[]
  });

  const [machines, setMachines] = useState<Machine[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const pmCalendarRef = useRef<PMCalendarRef>(null);
  const [scheduleData, setScheduleData] = useState({
    machineId: '',
    checklistId: '',
    nextMaintenanceDate: '',
    technicianName: '',
    notes: ''
  });

  // Effect for filtering checklists based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredChecklists(checklists);
    } else {
      const filtered = checklists.filter(checklist =>
        checklist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.machine_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredChecklists(filtered);
    }
  }, [checklists, searchTerm]);

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

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/v1/pm/checklists');
      setChecklists(response.data);
      setFilteredChecklists(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching checklists:', err);
      setError('Failed to fetch checklists');
    } finally {
      setLoading(false);
    }
  };

  const fetchMachines = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/machines');
      setMachines(response.data);
    } catch (err: any) {
      console.error('Error fetching machines:', err);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/technicians');
      setTechnicians(response.data);
    } catch (err: any) {
      console.error('Error fetching technicians:', err);
    }
  };

  const fetchMaintenanceStats = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/pm/stats');
      setOverdueCount(response.data.overdue || 0);
      setDueCount(response.data.due_soon || 0);
    } catch (err: any) {
      console.error('Error fetching maintenance stats:', err);
    }
  };

  useEffect(() => {
    fetchChecklists();
    fetchMachines();
    fetchTechnicians();
    fetchMaintenanceStats();
  }, []);

  const fetchChecklistWithTasks = async (checklistId: number) => {
    const response = await axiosInstance.get(`/api/v1/pm/checklists/${checklistId}/tasks`);
    return response.data;
  };

  const handleCreateNew = () => {
    setEditingChecklist(null);
    setFormData({
      name: '',
      description: '',
      machine_id: '',
      machine_type: '',
      tasks: []
    });
    setOpenDialog(true);
  };

  const handleEdit = (checklist: PMChecklist) => {
    setEditingChecklist(checklist);
    setFormData({
      name: checklist.name,
      description: checklist.description,
      machine_id: '',
      machine_type: checklist.machine_type,
      tasks: checklist.tasks || []
    });
    setOpenDialog(true);
  };

  // Note: handleDelete function exists but is not currently connected to any UI element
  // const handleDelete = (checklist: PMChecklist) => {
  //   setChecklistToDelete(checklist);
  //   setDeleteConfirmOpen(true);
  // };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingChecklist(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        name: formData.name,
        description: formData.description,
        machine_type: formData.machine_type,
        is_active: true,
        tasks: formData.tasks
      };

      if (editingChecklist) {
        await axiosInstance.put(`/api/v1/pm/checklists/${editingChecklist.checklist_id}`, payload);
        setSuccess('Checklist updated successfully!');
      } else {
        await axiosInstance.post('/api/v1/pm/checklists', payload);
        setSuccess('Checklist created successfully!');
      }

      await fetchChecklists();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving checklist:', err);
      setError(err.response?.data?.message || 'Failed to save checklist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!checklistToDelete) return;

    try {
      setIsSubmitting(true);
      await axiosInstance.delete(`/api/v1/pm/checklists/${checklistToDelete.checklist_id}`);
      await fetchChecklists();
      setDeleteConfirmOpen(false);
      setChecklistToDelete(null);
      setSuccess('Checklist deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting checklist:', err);
      setError('Failed to delete checklist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, {
        task_name: '',
        task_description: '',
        is_required: false,
        order_position: prev.tasks.length + 1
      }]
    }));
  };

  const handleTaskChange = (index: number, field: keyof PMTask, value: any) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const handleRemoveTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  const toggleShowTasks = async (checklistId: number) => {
    if (showTasks[checklistId]) {
      setShowTasks(prev => ({ ...prev, [checklistId]: false }));
    } else {
      try {
        const checklistWithTasks = await fetchChecklistWithTasks(checklistId);
        setChecklists(prev => prev.map(c => 
          c.checklist_id === checklistId ? { ...c, tasks: checklistWithTasks.tasks } : c
        ));
        setShowTasks(prev => ({ ...prev, [checklistId]: true }));
      } catch (err: any) {
        setError('Failed to load checklist tasks');
      }
    }
  };

  const handleScheduleOpen = (machine?: Machine) => {
    if (machine) {
      setSelectedMachineForSchedule(machine);
      setScheduleData(prev => ({ ...prev, machineId: String(machine.machine_id || machine.id) }));
    }
    setScheduleDialogOpen(true);
  };

  const handleScheduleClose = () => {
    setScheduleDialogOpen(false);
    setSelectedMachineForSchedule(null);
    setScheduleData({
      machineId: '',
      checklistId: '',
      nextMaintenanceDate: '',
      technicianName: '',
      notes: ''
    });
  };

  const handleScheduleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await axiosInstance.post('/api/v1/pm/schedule', scheduleData);
      await fetchMaintenanceStats();
      // Refresh the calendar to show the new scheduled maintenance
      if (pmCalendarRef.current) {
        pmCalendarRef.current.refreshSchedule();
      }
      handleScheduleClose();
      setSuccess('Maintenance scheduled successfully!');
    } catch (err: any) {
      console.error('Error scheduling maintenance:', err);
      setError('Failed to schedule maintenance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Note: handleTabChange function exists but tab changes are handled directly by onClick events
  // const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
  //   setActiveTab(newValue);
  // };

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Add export function
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      const checklistsToExport = filteredChecklists;
      if (checklistsToExport.length === 0) {
        setError('No checklists to export');
        return;
      }

      // Transform data for export
      const exportData = checklistsToExport.map((checklist: PMChecklist) => ({
        'Checklist Name': checklist.name,
        'Description': checklist.description,
        'Machine Type': checklist.machine_type,
        'Status': checklist.is_active ? 'Active' : 'Inactive',
        'Created Date': new Date(checklist.created_at).toLocaleDateString(),
        'Updated Date': new Date(checklist.updated_at).toLocaleDateString(),
        'Number of Tasks': checklist.tasks?.length || 0
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 25 }, // Checklist Name
        { wch: 40 }, // Description
        { wch: 20 }, // Machine Type
        { wch: 15 }, // Status
        { wch: 15 }, // Created Date
        { wch: 15 }, // Updated Date
        { wch: 15 }, // Number of Tasks
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'PM Checklists');
      
      // Generate filename
      const filename = `pm_checklists_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('PM checklists exported successfully!');
    } catch (error: any) {
      console.error('Error exporting checklists:', error);
      setError('Failed to export checklists');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Define DataGrid columns
  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Checklist Name', flex: 1.5 },
    { field: 'description', headerName: 'Description', flex: 2 },
    { field: 'machine_type', headerName: 'Machine Type', width: 150 },
    { 
      field: 'is_active', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value ? 'Active' : 'Inactive'} 
          size="small"
          color={params.value ? 'success' : 'default'}
          variant="outlined"
        />
      )
    },
    { 
      field: 'tasks_count', 
      headerName: 'Tasks', 
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.row.tasks?.length || 0} 
          size="small"
          color="info"
          variant="outlined"
        />
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => 
        new Date(params.value).toLocaleDateString()
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
            onClick={() => handleEdit(params.row)}
            sx={{ 
              backgroundColor: '#FF6600',
              color: 'white',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
            title="Edit Checklist"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => toggleShowTasks(params.row.checklist_id)}
            sx={{ 
              backgroundColor: '#0066A1',
              color: 'white',
              '&:hover': { backgroundColor: '#004d7a' }
            }}
            title="View Tasks"
          >
            <AssignmentIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setChecklistToDelete(params.row);
              setDeleteConfirmOpen(true);
            }}
            sx={{ 
              backgroundColor: '#f44336',
              color: 'white',
              '&:hover': { backgroundColor: '#d32f2f' }
            }}
            title="Delete Checklist"
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
        PM Management System
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={3}
            sx={{ 
              borderRadius: '0.75rem',
              borderLeft: '4px solid #f44336',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Overdue
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                    {overdueCount}
                  </Typography>
                </Box>
                <ErrorIcon sx={{ fontSize: '1.8rem', color: '#f44336' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={3}
            sx={{ 
              borderRadius: '0.75rem',
              borderLeft: '4px solid #ff9800',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Due Soon
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                    {dueCount}
                  </Typography>
                </Box>
                <CalendarIcon sx={{ fontSize: '1.8rem', color: '#ff9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={3}
            sx={{ 
              borderRadius: '0.75rem',
              borderLeft: '4px solid #FF6600',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Checklists
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#FF6600', fontWeight: 'bold' }}>
                    {checklists.length}
                  </Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize: '1.8rem', color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={3}
            sx={{ 
              borderRadius: '0.75rem',
              borderLeft: '4px solid #0066A1',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Machines
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#0066A1', fontWeight: 'bold' }}>
                    {machines.length}
                  </Typography>
                </Box>
                <BuildIcon sx={{ fontSize: '1.8rem', color: '#0066A1' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search checklists by name, description, or machine type..."
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
                variant="outlined"
                onClick={() => handleScheduleOpen()}
                startIcon={<ScheduleIcon />}
                sx={{ 
                  borderColor: '#0066A1',
                  color: '#0066A1',
                  '&:hover': { 
                    borderColor: '#004d7a',
                    backgroundColor: 'rgba(0, 102, 161, 0.04)'
                  },
                  minWidth: '160px'
                }}
              >
                Schedule Maintenance
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateNew}
                startIcon={<AddIcon />}
                sx={{ 
                  backgroundColor: '#FF6600', 
                  borderColor: '#FF6600',
                  '&:hover': { backgroundColor: '#e65c00' },
                  minWidth: '160px'
                }}
              >
                Create Checklist
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

        {/* Statistics and Tab Chips */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<AssignmentIcon />}
            label={`Checklists (${activeTab === 0 ? 'Viewing' : 'Available'})`}
            onClick={() => setActiveTab(0)}
            color={activeTab === 0 ? "primary" : "default"}
            variant={activeTab === 0 ? "filled" : "outlined"}
            sx={{ 
              backgroundColor: activeTab === 0 ? '#FF6600' : 'transparent',
              color: activeTab === 0 ? 'white' : '#FF6600',
              borderColor: '#FF6600',
              '&:hover': { backgroundColor: activeTab === 0 ? '#e65c00' : 'rgba(255, 102, 0, 0.04)' }
            }}
          />
          <Chip
            icon={<CalendarIcon />}
            label={`Schedule ${(overdueCount + dueCount) > 0 ? `(${overdueCount + dueCount} due)` : ''}`}
            onClick={() => setActiveTab(1)}
            color={activeTab === 1 ? "primary" : "default"}
            variant={activeTab === 1 ? "filled" : "outlined"}
            sx={{ 
              backgroundColor: activeTab === 1 ? '#0066A1' : 'transparent',
              color: activeTab === 1 ? 'white' : '#0066A1',
              borderColor: '#0066A1',
              '&:hover': { backgroundColor: activeTab === 1 ? '#004d7a' : 'rgba(0, 102, 161, 0.04)' }
            }}
          />
          
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
            <Chip 
              label={`${filteredChecklists.length} checklists showing`} 
              color="primary" 
              variant="outlined"
              sx={{ 
                borderColor: '#FF6600',
                color: '#FF6600',
                backgroundColor: 'rgba(255, 102, 0, 0.04)'
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
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
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
            {filteredChecklists.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No checklists match your search' : 'No checklists found'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 
                    'Try adjusting your search terms or clear the search to see all checklists.' :
                    'Create your first checklist to get started with preventive maintenance.'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    onClick={handleCreateNew}
                    startIcon={<AddIcon />}
                    sx={{ 
                      backgroundColor: '#FF6600',
                      '&:hover': { backgroundColor: '#e65c00' }
                    }}
                  >
                    Create Checklist
                  </Button>
                )}
              </Box>
            ) : (
              <StyledDataGrid
                columns={columns}
                rows={filteredChecklists}
                getRowId={(row) => row.checklist_id}
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
      )}

      {activeTab === 1 && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            borderRadius: '0.75rem',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            backgroundColor: 'white'
          }}
        >
          <PMCalendar ref={pmCalendarRef} />
        </Paper>
      )}

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

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingChecklist ? 'Edit Checklist' : 'Create New Checklist'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Checklist Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Machine Type</InputLabel>
            <Select
              value={formData.machine_type}
              label="Machine Type"
              onChange={(e) => setFormData({...formData, machine_type: e.target.value})}
            >
              <MenuItem value="ATM">ATM</MenuItem>
              <MenuItem value="ITM">ITM</MenuItem>
              <MenuItem value="Printer">Printer</MenuItem>
              <MenuItem value="Scanner">Scanner</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Tasks
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddTask}
              sx={{ ml: 2 }}
            >
              Add Task
            </Button>
          </Typography>

          {formData.tasks.map((task, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    size="small"
                    label="Task Name"
                    fullWidth
                    value={task.task_name}
                    onChange={(e) => handleTaskChange(index, 'task_name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    size="small"
                    label="Description"
                    fullWidth
                    value={task.task_description}
                    onChange={(e) => handleTaskChange(index, 'task_description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} sm={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={task.is_required}
                        onChange={(e) => handleTaskChange(index, 'is_required', e.target.checked)}
                      />
                    }
                    label="Required"
                  />
                </Grid>
                <Grid item xs={6} sm={1}>
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveTask(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? <CircularProgress size={20} /> : (editingChecklist ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
            Confirm Delete
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the checklist "{checklistToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={handleScheduleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          backgroundColor: '#0066A1', 
          color: 'white',
          borderRadius: '0.75rem 0.75rem 0 0'
        }}>
          <Typography variant="h6" sx={{ color: 'white' }}>
            Schedule Maintenance
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Machine</InputLabel>
            <Select
              value={scheduleData.machineId}
              label="Machine"
              onChange={(e) => setScheduleData({...scheduleData, machineId: e.target.value})}
            >
              {machines.map((machine) => (
                <MenuItem key={machine.machine_id || machine.id} value={machine.machine_id || machine.id}>
                  {machine.name} ({machine.location})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Checklist</InputLabel>
            <Select
              value={scheduleData.checklistId}
              label="Checklist"
              onChange={(e) => setScheduleData({...scheduleData, checklistId: e.target.value})}
            >
              {checklists.map((checklist) => (
                <MenuItem key={checklist.checklist_id} value={checklist.checklist_id}>
                  {checklist.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            type="datetime-local"
            label="Next Maintenance Date"
            fullWidth
            sx={{ mb: 2 }}
            value={scheduleData.nextMaintenanceDate}
            onChange={(e) => setScheduleData({...scheduleData, nextMaintenanceDate: e.target.value})}
            InputLabelProps={{ shrink: true }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Technician</InputLabel>
            <Select
              value={scheduleData.technicianName}
              label="Technician"
              onChange={(e) => setScheduleData({...scheduleData, technicianName: e.target.value})}
            >
              <MenuItem value="">
                <em>Select a technician</em>
              </MenuItem>
              {technicians.map((technician) => (
                <MenuItem key={technician.technician_id} value={technician.name}>
                  {technician.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={3}
            value={scheduleData.notes}
            onChange={(e) => setScheduleData({...scheduleData, notes: e.target.value})}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScheduleClose}>Cancel</Button>
          <Button 
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={isSubmitting || !scheduleData.machineId || !scheduleData.checklistId}
            sx={{ 
              backgroundColor: '#FF6600', 
              '&:hover': { backgroundColor: '#e65c00' }
            }}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PMChecklistManagement;