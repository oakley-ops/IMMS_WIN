import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TimelineIcon from '@mui/icons-material/Timeline';
import { format } from 'date-fns';

import { 
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../../services/projectService';
import { Project } from '../../types/project';

const statusColors = {
  planning: 'default',
  in_progress: 'primary',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error'
};

const priorityColors = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error'
};

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
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
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const projectsData = await getAllProjects();
        setProjects(projectsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, []);
  
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
      if (editingProject) {
        // Update existing project
        await updateProject(editingProject.project_id, projectFormData);
      } else {
        // Create new project
        await createProject(projectFormData as Omit<Project, 'project_id' | 'created_at' | 'updated_at'>);
      }
      
      // Refresh project list
      const projectsData = await getAllProjects();
      setProjects(projectsData);
      
      setOpenProjectDialog(false);
    } catch (err) {
      console.error('Error saving project:', err);
      setError('Failed to save project');
    }
  };
  
  const handleDeleteProject = async (projectId: number) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        
        // Remove from list
        setProjects(prev => prev.filter(p => p.project_id !== projectId));
      } catch (err) {
        console.error('Error deleting project:', err);
        setError('Failed to delete project');
      }
    }
  };
  
  // Function to navigate to the project timeline
  const viewTimeline = (projectId: number) => {
    navigate(`/projects/${projectId}/timeline`);
  };
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">{error}</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          Projects
        </Typography>
        
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenProjectDialog()}
        >
          New Project
        </Button>
      </Box>
      
      {projects.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>No projects found</Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpenProjectDialog()}
          >
            Create First Project
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Project Manager</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.project_id}>
                  <TableCell>
                    <Typography variant="subtitle1">
                      {project.name}
                    </Typography>
                    {project.description && (
                      <Typography variant="body2" color="text.secondary">
                        {project.description.substring(0, 60)}
                        {project.description.length > 60 ? '...' : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={project.status} 
                      color={statusColors[project.status] as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={project.priority} 
                      color={priorityColors[project.priority] as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {project.start_date && format(new Date(project.start_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'TBD'}
                  </TableCell>
                  <TableCell>{project.project_manager || 'Not assigned'}</TableCell>
                  <TableCell>
                    <Tooltip title="Timeline">
                      <IconButton 
                        size="small" 
                        onClick={() => viewTimeline(project.project_id)}
                      >
                        <TimelineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenProjectDialog(project)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small"
                        onClick={() => handleDeleteProject(project.project_id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Project Dialog */}
      <Dialog 
        open={openProjectDialog} 
        onClose={handleCloseProjectDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProject ? 'Edit Project' : 'Create New Project'}
        </DialogTitle>
        <form onSubmit={handleSubmitProject}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Project Name"
                  name="name"
                  value={projectFormData.name}
                  onChange={handleProjectFormChange}
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
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Project Manager"
                  name="project_manager"
                  value={projectFormData.project_manager}
                  onChange={handleProjectFormChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseProjectDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ProjectList; 