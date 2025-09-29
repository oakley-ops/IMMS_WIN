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
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Timeline as TimelineIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
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
import { format } from 'date-fns';

import { 
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../../services/projectService';
import { Project } from '../../types/project';

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

const statusColors = {
  planning: 'default',
  in_progress: 'primary',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error'
} as const;

const priorityColors = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error'
} as const;

type ProjectStatus = keyof typeof statusColors;
type ProjectPriority = keyof typeof priorityColors;
type StatusFilter = ProjectStatus | 'all';
type PriorityFilter = ProjectPriority | 'all';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(true);
  
  // Project dialog state
  const [openProjectDialog, setOpenProjectDialog] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectFormData, setProjectFormData] = useState<Partial<Project>>({
    name: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    status: 'planning',
    budget: 0,
    facility_id: null,
    project_manager: '',
    priority: 'medium'
  });

  // Effect for filtering projects based on search term and filters
  useEffect(() => {
    let filtered = projects;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_manager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(project => project.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(project => project.priority === filterPriority);
    }

    // Filter by active only (exclude completed and cancelled)
    if (showActiveOnly) {
      filtered = filtered.filter(project => 
        project.status !== 'completed' && project.status !== 'cancelled'
      );
    }

    setFilteredProjects(filtered);
  }, [projects, searchTerm, filterStatus, filterPriority, showActiveOnly]);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching projects...');
      const projectsData = await getAllProjects();
      console.log('Projects response:', projectsData);
      
      setProjects(projectsData);
      setFilteredProjects(projectsData);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      const errorMessage = error.message || 'Failed to load projects';
      setError(errorMessage);
      setProjects([]);
      setFilteredProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const handleDelete = async (projectId: number | undefined) => {
    if (!projectId) {
      console.error('No Project ID provided for deletion');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        setIsLoading(true);
        await deleteProject(projectId);
        setProjects(projects.filter(project => project.project_id !== projectId));
        setSuccess('Project deleted successfully');
      } catch (error: any) {
        console.error('Error deleting project:', error);
        const errorMessage = error.message || 'Failed to delete project';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle search input changes
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);
      
      const projectsToExport = filteredProjects;
      if (projectsToExport.length === 0) {
        setError('No projects to export');
        return;
      }

      // Transform data for export
      const exportData = projectsToExport.map((project: Project) => ({
        'Project Name': project.name || '',
        'Description': project.description || '',
        'Status': project.status?.charAt(0).toUpperCase() + project.status?.slice(1) || '',
        'Priority': project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1) || '',
        'Project Manager': project.project_manager || '',
        'Start Date': project.start_date ? format(new Date(project.start_date), 'MM/dd/yyyy') : 'N/A',
        'End Date': project.end_date ? format(new Date(project.end_date), 'MM/dd/yyyy') : 'TBD',
        'Budget': project.budget ? `$${project.budget.toLocaleString()}` : '$0',
        'Created Date': project.created_at ? format(new Date(project.created_at), 'MM/dd/yyyy') : 'N/A',
        'Updated Date': project.updated_at ? format(new Date(project.updated_at), 'MM/dd/yyyy') : 'N/A'
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 25 }, // Project Name
        { wch: 40 }, // Description
        { wch: 15 }, // Status
        { wch: 12 }, // Priority
        { wch: 20 }, // Project Manager
        { wch: 15 }, // Start Date
        { wch: 15 }, // End Date
        { wch: 15 }, // Budget
        { wch: 15 }, // Created
        { wch: 15 }, // Updated
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
      
      // Generate filename
      const filename = `projects_${new Date().toISOString().split('T')[0]}.xlsx`;
        
      // Export file
      XLSX.writeFile(workbook, filename);
      setSuccess('Projects exported successfully!');
    } catch (error: any) {
      console.error('Error exporting projects:', error);
      setError('Failed to export projects');
    } finally {
      setExportLoading(false);
    }
  };

  // Project dialog handlers
  const handleOpenProjectDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectFormData({
        name: project.name,
        description: project.description || '',
        start_date: project.start_date,
        end_date: project.end_date || '',
        status: project.status,
        budget: project.budget || 0,
        facility_id: project.facility_id,
        project_manager: project.project_manager || '',
        priority: project.priority
      });
    } else {
      setEditingProject(null);
      setProjectFormData({
        name: '',
        description: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
        status: 'planning',
        budget: 0,
        facility_id: null,
        project_manager: '',
        priority: 'medium'
      });
    }
    setOpenProjectDialog(true);
  };

  const handleCloseProjectDialog = () => {
    setOpenProjectDialog(false);
  };

  const handleProjectFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      if (editingProject) {
        // Update existing project
        await updateProject(editingProject.project_id, projectFormData);
        setSuccess('Project updated successfully');
      } else {
        // Create new project
        await createProject(projectFormData as Omit<Project, 'project_id' | 'created_at' | 'updated_at'>);
        setSuccess('Project created successfully');
      }
      
      // Refresh project list
      await fetchProjects();
      setOpenProjectDialog(false);
    } catch (error: any) {
      console.error('Error saving project:', error);
      setError('Failed to save project');
    } finally {
      setIsLoading(false);
    }
  };

  // Define DataGrid columns
  const columns: GridColDef[] = [
    { 
      field: 'name', 
      headerName: 'Project Name', 
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {params.value}
          </Typography>
          {params.row.description && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {params.row.description.substring(0, 40)}
              {params.row.description.length > 40 ? '...' : ''}
            </Typography>
          )}
        </Box>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value?.charAt(0).toUpperCase() + params.value?.slice(1) || 'N/A'} 
          size="small"
          color={statusColors[params.value as ProjectStatus] as any}
          variant="outlined"
        />
      )
    },
    { 
      field: 'priority', 
      headerName: 'Priority', 
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value?.charAt(0).toUpperCase() + params.value?.slice(1) || 'N/A'} 
          size="small"
          color={priorityColors[params.value as ProjectPriority] as any}
          variant="outlined"
        />
      )
    },
    { 
      field: 'start_date', 
      headerName: 'Start Date', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value ? format(new Date(params.value), 'MMM d, yyyy') : 'N/A'}
        </Typography>
      )
    },
    { 
      field: 'end_date', 
      headerName: 'End Date', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value ? format(new Date(params.value), 'MMM d, yyyy') : 'TBD'}
        </Typography>
      )
    },
    { 
      field: 'budget', 
      headerName: 'Budget', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          ${typeof params.value === 'number' ? params.value.toLocaleString() : '0'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => navigate(`/projects/${params.row.project_id}/timeline`)}
            sx={{ 
              backgroundColor: '#0066A1',
              color: 'white',
              '&:hover': { backgroundColor: '#004d7a' }
            }}
            title="View Timeline"
          >
            <TimelineIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleOpenProjectDialog(params.row)}
            sx={{ 
              backgroundColor: '#FF6600',
              color: 'white',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
            title="Edit Project"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.project_id)}
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
        Projects Management
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Actions */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by name, description, manager, or status..."
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
                  onClick={() => handleOpenProjectDialog()}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' },
                    minWidth: '140px'
                  }}
                >
                  New Project
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleExportToExcel}
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

          {/* Filters and Statistics */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e0e0e0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={filterPriority}
                label="Priority"
                onChange={(e) => setFilterPriority(e.target.value as PriorityFilter)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e0e0e0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF6600',
                  },
                }}
              >
                <MenuItem value="all">All Priority</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  sx={{
                    color: '#FF6600',
                    '&.Mui-checked': {
                      color: '#FF6600',
                    },
                  }}
                />
              }
              label="Show active projects only"
              sx={{ 
                '& .MuiFormControlLabel-label': { 
                  fontSize: '0.875rem',
                  color: '#666'
                }
              }}
            />
            
            <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
              <Chip 
                label={`${filteredProjects.length} projects showing`} 
                color="primary" 
                variant="outlined"
                sx={{ 
                  borderColor: '#FF6600',
                  color: '#FF6600',
                  backgroundColor: 'rgba(255, 102, 0, 0.04)'
                }}
              />
              <Chip 
                label={`${projects.length} total projects`} 
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

          {/* Stats Cards */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              icon={<CalendarIcon />}
              label={`${projects.filter(p => p.status === 'planning').length} Planning`} 
              variant="outlined"
              sx={{ borderColor: '#666', color: '#666' }}
            />
            <Chip 
              icon={<BusinessIcon />}
              label={`${projects.filter(p => p.status === 'in_progress').length} In Progress`} 
              variant="outlined"
              sx={{ borderColor: '#0066A1', color: '#0066A1' }}
            />
            <Chip 
              icon={<BusinessIcon />}
              label={`${projects.filter(p => p.status === 'completed').length} Completed`} 
              variant="outlined"
              sx={{ borderColor: '#28a745', color: '#28a745' }}
            />
          </Box>
        </Paper>

        {/* Projects Table */}
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
                <Typography variant="body1" sx={{ mt: 2 }}>Loading projects...</Typography>
              </Box>
            ) : error ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="error" gutterBottom>
                  Error Loading Projects
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {error}
                </Typography>
                <Button
                  variant="contained"
                  onClick={fetchProjects}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    backgroundColor: '#FF6600',
                    '&:hover': { backgroundColor: '#e65c00' }
                  }}
                >
                  Retry
                </Button>
              </Box>
            ) : filteredProjects.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No projects match your search' : 'No projects found'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 
                    'Try adjusting your search terms or clear the search to see all projects.' :
                    'Use the "New Project" button to create your first project.'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    onClick={() => handleOpenProjectDialog()}
                    startIcon={<AddIcon />}
                    sx={{ 
                      backgroundColor: '#FF6600',
                      '&:hover': { backgroundColor: '#e65c00' }
                    }}
                  >
                    New Project
                  </Button>
                )}
              </Box>
            ) : (
              <StyledDataGrid
                columns={columns}
                rows={filteredProjects}
                getRowId={(row) => row.project_id}
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

      {/* Project Dialog */}
      <Dialog 
        open={openProjectDialog} 
        onClose={handleCloseProjectDialog}
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
              <BusinessIcon sx={{ mr: 1, color: '#FF6600' }} />
              <Typography variant="h6" sx={{ color: 'white' }}>
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </Typography>
            </Box>
            <IconButton 
              onClick={handleCloseProjectDialog} 
              size="small"
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmitProject}>
          <DialogContent dividers sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Project Name"
                  name="name"
                  value={projectFormData.name}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  name="description"
                  value={projectFormData.description}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Start Date"
                  name="start_date"
                  type="date"
                  value={projectFormData.start_date}
                  onChange={handleProjectFormChange}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  name="end_date"
                  type="date"
                  value={projectFormData.end_date}
                  onChange={handleProjectFormChange}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  name="status"
                  value={projectFormData.status}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                >
                  <MenuItem value="planning">Planning</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Priority"
                  name="priority"
                  value={projectFormData.priority}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Budget"
                  name="budget"
                  type="number"
                  value={projectFormData.budget}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Project Manager"
                  name="project_manager"
                  value={projectFormData.project_manager}
                  onChange={handleProjectFormChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: '#FF6600',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#FF6600',
                    },
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button 
              onClick={handleCloseProjectDialog}
              sx={{ color: '#666' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={isLoading}
              sx={{ 
                backgroundColor: '#FF6600',
                '&:hover': { backgroundColor: '#e65c00' }
              }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                  Saving...
                </>
              ) : (
                editingProject ? 'Update Project' : 'Create Project'
              )}
            </Button>
          </DialogActions>
        </form>
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

export default ProjectList;
