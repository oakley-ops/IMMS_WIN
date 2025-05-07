import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { format } from 'date-fns';

import { 
  getProjectById, 
  getProjectTimeline, 
  createEquipment,
  updateEquipment,
  deleteEquipment,
  addEquipmentDependency,
  createMilestone,
  createTask,
} from '../../services/projectService';
import {
  Project,
  EquipmentInstallation,
  ProjectMilestone,
  ProjectTask,
  EquipmentDependency,
} from '../../types/project';
import { formatDate } from '../../utils/dateUtils';

type TimelineItemType = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'milestone' | 'equipment' | 'task';
  description?: string;
  status: string;
  dependencies?: string[];
  location?: string;
  color: string;
};

const statusColors = {
  // Equipment statuses
  pending: '#9e9e9e',
  ordered: '#2196f3',
  delivered: '#ff9800',
  installed: '#4caf50',
  tested: '#8bc34a',
  operational: '#009688',
  delayed: '#f44336',
  
  // Milestone statuses
  'in_progress': '#2196f3',
  completed: '#4caf50',
  
  // Default
  default: '#9e9e9e'
};

const ProjectTimeline: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [timelineItems, setTimelineItems] = useState<TimelineItemType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Equipment dialog state
  const [openEquipmentDialog, setOpenEquipmentDialog] = useState<boolean>(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentInstallation | null>(null);
  const [equipmentFormData, setEquipmentFormData] = useState<Partial<EquipmentInstallation>>({
    equipment_name: '',
    equipment_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    planned_installation_date: '',
    status: 'pending',
    location_in_facility: '',
    installation_notes: ''
  });
  
  // Milestone dialog state
  const [openMilestoneDialog, setOpenMilestoneDialog] = useState<boolean>(false);
  const [milestoneFormData, setMilestoneFormData] = useState<Partial<ProjectMilestone>>({
    name: '',
    description: '',
    due_date: '',
    status: 'pending'
  });
  
  // Task dialog state
  const [openTaskDialog, setOpenTaskDialog] = useState<boolean>(false);
  const [taskFormData, setTaskFormData] = useState<Partial<ProjectTask>>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'not_started',
    assignee: ''
  });
  
  // Dependencies dialog state
  const [openDependencyDialog, setOpenDependencyDialog] = useState<boolean>(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentInstallation[]>([]);
  const [dependencies, setDependencies] = useState<EquipmentDependency[]>([]);
  
  // Fetch project and timeline data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        if (!projectId) {
          setError('No project ID provided');
          setLoading(false);
          return;
        }
        
        // Make sure projectId is a valid number
        const projectIdNum = parseInt(projectId);
        if (isNaN(projectIdNum)) {
          setError(`Invalid project ID: ${projectId}`);
          setLoading(false);
          return;
        }
        
        const projectData = await getProjectById(projectIdNum);
        setProject(projectData);
        
        const timelineData = await getProjectTimeline(projectIdNum);
        
        // Map the API data to our timeline format
        const mappedItems: TimelineItemType[] = [];
        
        // Add equipment installations
        timelineData.equipment.forEach(equipment => {
          mappedItems.push({
            id: `equipment-${equipment.installation_id}`,
            title: equipment.equipment_name,
            date: equipment.planned_installation_date || '',
            endDate: equipment.actual_installation_date || undefined,
            type: 'equipment',
            description: equipment.installation_notes || '',
            status: equipment.status,
            location: equipment.location_in_facility || '',
            color: statusColors[equipment.status] || statusColors.default
          });
        });
        
        // Add milestones
        timelineData.milestones.forEach(milestone => {
          mappedItems.push({
            id: `milestone-${milestone.milestone_id}`,
            title: milestone.name,
            date: milestone.due_date || '',
            type: 'milestone',
            description: milestone.description || '',
            status: milestone.status,
            color: statusColors[milestone.status] || statusColors.default
          });
        });
        
        // Add tasks
        timelineData.tasks.forEach(task => {
          mappedItems.push({
            id: `task-${task.task_id}`,
            title: task.name,
            date: task.start_date || '',
            endDate: task.end_date || undefined,
            type: 'task',
            description: task.description || '',
            status: task.status,
            color: statusColors.default
          });
        });
        
        // Sort items by date
        mappedItems.sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        
        setTimelineItems(mappedItems);
        setEquipmentOptions(timelineData.equipment);
        setDependencies(timelineData.dependencies);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching project data:', err);
        setError('Failed to load project data');
        setLoading(false);
      }
    };
    
    fetchProjectData();
  }, [projectId]);
  
  // Equipment form handlers
  const handleOpenEquipmentDialog = (equipment?: EquipmentInstallation) => {
    if (equipment) {
      setEditingEquipment(equipment);
      setEquipmentFormData({
        equipment_name: equipment.equipment_name,
        equipment_type: equipment.equipment_type || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        planned_installation_date: equipment.planned_installation_date || '',
        actual_installation_date: equipment.actual_installation_date || '',
        status: equipment.status,
        location_in_facility: equipment.location_in_facility || '',
        installation_notes: equipment.installation_notes || ''
      });
    } else {
      setEditingEquipment(null);
      setEquipmentFormData({
        equipment_name: '',
        equipment_type: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        planned_installation_date: '',
        status: 'pending',
        location_in_facility: '',
        installation_notes: ''
      });
    }
    setOpenEquipmentDialog(true);
  };
  
  const handleCloseEquipmentDialog = () => {
    setOpenEquipmentDialog(false);
  };
  
  const handleEquipmentFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEquipmentFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmitEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!projectId) return;
      
      // Make sure projectId is a valid number
      const projectIdNum = parseInt(projectId);
      if (isNaN(projectIdNum)) {
        setError(`Invalid project ID: ${projectId}`);
        return;
      }
      
      const equipmentData = {
        ...equipmentFormData,
        project_id: projectIdNum
      };
      
      if (editingEquipment) {
        // Update existing equipment
        await updateEquipment(editingEquipment.installation_id, equipmentData);
      } else {
        // Create new equipment
        await createEquipment(equipmentData as Omit<EquipmentInstallation, 'installation_id' | 'created_at' | 'updated_at'>);
      }
      
      // Refresh data
      const timelineData = await getProjectTimeline(projectIdNum);
      const mappedItems: TimelineItemType[] = [];
      
      timelineData.equipment.forEach(equipment => {
        mappedItems.push({
          id: `equipment-${equipment.installation_id}`,
          title: equipment.equipment_name,
          date: equipment.planned_installation_date || '',
          endDate: equipment.actual_installation_date || undefined,
          type: 'equipment',
          description: equipment.installation_notes || '',
          status: equipment.status,
          location: equipment.location_in_facility || '',
          color: statusColors[equipment.status] || statusColors.default
        });
      });
      
      // Re-add milestones and tasks
      timelineItems
        .filter(item => item.type !== 'equipment')
        .forEach(item => mappedItems.push(item));
      
      // Sort items by date
      mappedItems.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      setTimelineItems(mappedItems);
      setEquipmentOptions(timelineData.equipment);
      setOpenEquipmentDialog(false);
    } catch (err) {
      console.error('Error saving equipment:', err);
      setError('Failed to save equipment');
    }
  };
  
  // Milestone form handlers
  const handleOpenMilestoneDialog = () => {
    setMilestoneFormData({
      name: '',
      description: '',
      due_date: '',
      status: 'pending'
    });
    setOpenMilestoneDialog(true);
  };
  
  const handleCloseMilestoneDialog = () => {
    setOpenMilestoneDialog(false);
  };
  
  const handleMilestoneFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMilestoneFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmitMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!projectId) return;
      
      const milestoneData = {
        ...milestoneFormData,
        project_id: parseInt(projectId)
      };
      
      // Create new milestone
      const newMilestone = await createMilestone(milestoneData as Omit<ProjectMilestone, 'milestone_id' | 'created_at' | 'updated_at'>);
      
      // Refresh timeline data
      const timelineData = await getProjectTimeline(parseInt(projectId));
      
      // Update timeline items
      const mappedItems = [...timelineItems];
      
      // Add the new milestone
      mappedItems.push({
        id: `milestone-${newMilestone.milestone_id}`,
        title: newMilestone.name,
        date: newMilestone.due_date || '',
        type: 'milestone',
        description: newMilestone.description || '',
        status: newMilestone.status,
        color: statusColors[newMilestone.status] || statusColors.default
      });
      
      // Sort items by date
      mappedItems.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      setTimelineItems(mappedItems);
      setOpenMilestoneDialog(false);
    } catch (err) {
      console.error('Error saving milestone:', err);
      setError('Failed to save milestone');
    }
  };
  
  // Task form handlers
  const handleOpenTaskDialog = () => {
    setTaskFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'not_started',
      assignee: ''
    });
    setOpenTaskDialog(true);
  };
  
  const handleCloseTaskDialog = () => {
    setOpenTaskDialog(false);
  };
  
  const handleTaskFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTaskFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!projectId) return;
      
      const taskData = {
        ...taskFormData,
        project_id: parseInt(projectId)
      };
      
      // Create new task
      const newTask = await createTask(taskData as Omit<ProjectTask, 'task_id' | 'created_at' | 'updated_at'>);
      
      // Refresh timeline data
      const timelineData = await getProjectTimeline(parseInt(projectId));
      
      // Update timeline items
      const mappedItems = [...timelineItems];
      
      // Add the new task
      mappedItems.push({
        id: `task-${newTask.task_id}`,
        title: newTask.name,
        date: newTask.start_date || '',
        endDate: newTask.end_date || undefined,
        type: 'task',
        description: newTask.description || '',
        status: newTask.status,
        color: statusColors.default
      });
      
      // Sort items by date
      mappedItems.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      setTimelineItems(mappedItems);
      setOpenTaskDialog(false);
    } catch (err) {
      console.error('Error saving task:', err);
      setError('Failed to save task');
    }
  };
  
  // Dependency dialog handlers
  const handleOpenDependencyDialog = () => {
    setOpenDependencyDialog(true);
  };
  
  const handleCloseDependencyDialog = () => {
    setOpenDependencyDialog(false);
    setSelectedEquipment(null);
    setSelectedDependency(null);
  };
  
  const handleAddDependency = async () => {
    if (!selectedEquipment || !selectedDependency) return;
    
    try {
      await addEquipmentDependency(
        parseInt(selectedEquipment.split('-')[1]),
        { 
          depends_on_id: parseInt(selectedDependency.split('-')[1]),
          dependency_type: 'must be installed after'
        }
      );
      
      // Refresh data
      if (projectId) {
        // Make sure projectId is a valid number
        const projectIdNum = parseInt(projectId);
        if (isNaN(projectIdNum)) {
          setError(`Invalid project ID: ${projectId}`);
          return;
        }
        
        const timelineData = await getProjectTimeline(projectIdNum);
        setDependencies(timelineData.dependencies);
      }
      
      setOpenDependencyDialog(false);
      setSelectedEquipment(null);
      setSelectedDependency(null);
    } catch (err) {
      console.error('Error adding dependency:', err);
      setError('Failed to add dependency');
    }
  };
  
  // Custom Timeline component
  const TimelineItem = ({ item, index }: { item: TimelineItemType, index: number }) => {
    return (
      <Box sx={{ display: 'flex', mb: 4 }}>
        {/* Date column */}
        <Box sx={{ 
          width: '150px', 
          pr: 2, 
          textAlign: 'right',
          pt: 1
        }}>
          <Typography variant="body2" color="text.secondary">
            {item.date ? format(new Date(item.date), 'MMM d, yyyy') : 'Date TBD'}
          </Typography>
          {item.endDate && (
            <Typography variant="body2" color="text.secondary">
              to {format(new Date(item.endDate), 'MMM d, yyyy')}
            </Typography>
          )}
        </Box>
        
        {/* Timeline connector */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          width: '50px' 
        }}>
          <Box 
            sx={{ 
              width: '20px', 
              height: '20px', 
              borderRadius: '50%', 
              bgcolor: item.color,
              zIndex: 1
            }} 
          />
          {index < timelineItems.length - 1 && (
            <Box 
              sx={{ 
                width: '2px', 
                flexGrow: 1, 
                bgcolor: 'grey.300', 
                my: 0.5 
              }} 
            />
          )}
        </Box>
        
        {/* Content */}
        <Box sx={{ flexGrow: 1, pl: 2 }}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="h6" component="div">
                  {item.title}
                </Typography>
                
                {item.type === 'equipment' && (
                  <Box>
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          const equipmentId = parseInt(item.id.split('-')[1]);
                          const equipment = equipmentOptions.find(e => e.installation_id === equipmentId);
                          if (equipment) handleOpenEquipmentDialog(equipment);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small"
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this equipment?')) {
                            try {
                              const equipmentId = parseInt(item.id.split('-')[1]);
                              await deleteEquipment(equipmentId);
                              
                              // Remove from timeline
                              setTimelineItems(prev => prev.filter(i => i.id !== item.id));
                              setEquipmentOptions(prev => prev.filter(e => e.installation_id !== equipmentId));
                            } catch (err) {
                              console.error('Error deleting equipment:', err);
                              setError('Failed to delete equipment');
                            }
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              
              <Chip 
                label={item.type === 'milestone' ? 'Milestone' : item.type === 'equipment' ? 'Equipment' : 'Task'} 
                size="small" 
                sx={{ mt: 1, mr: 1 }}
              />
              <Chip 
                label={`Status: ${item.status}`} 
                size="small" 
                sx={{ mt: 1 }}
                style={{ backgroundColor: item.color, color: '#fff' }}
              />
              
              {item.description && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {item.description}
                </Typography>
              )}
              
              {item.location && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Location: {item.location}
                </Typography>
              )}
              
              {item.type === 'equipment' && (
                <Box sx={{ mt: 2 }}>
                  {dependencies
                    .filter(dep => {
                      const equipmentId = parseInt(item.id.split('-')[1]);
                      return dep.equipment_id === equipmentId;
                    })
                    .map((dep, i) => {
                      const dependsOn = equipmentOptions.find(e => e.installation_id === dep.depends_on_id);
                      return dependsOn ? (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Depends on: 
                          </Typography>
                          <ArrowRightAltIcon fontSize="small" sx={{ mx: 1 }} />
                          <Chip 
                            label={dependsOn.equipment_name} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      ) : null;
                    })
                  }
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };
  
  // Render the timeline with equipment, milestones, and dependencies
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
        <Box>
          <Typography variant="h4">{project?.name}</Typography>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Timeline &amp; Equipment Installation Schedule
          </Typography>
          <Chip 
            label={`Status: ${project?.status}`} 
            color={project?.status === 'in_progress' ? 'primary' : 'default'}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={`Priority: ${project?.priority}`} 
            color={
              project?.priority === 'high' ? 'warning' : 
              project?.priority === 'critical' ? 'error' : 
              'default'
            }
          />
        </Box>
        
        <Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpenEquipmentDialog()}
            sx={{ mr: 1 }}
          >
            Add Equipment
          </Button>
          <Button 
            variant="contained"
            color="success"
            startIcon={<FlagIcon />}
            onClick={handleOpenMilestoneDialog}
            sx={{ mr: 1 }}
          >
            Add Milestone
          </Button>
          <Button 
            variant="contained"
            color="info"
            startIcon={<AssignmentIcon />}
            onClick={handleOpenTaskDialog}
            sx={{ mr: 1 }}
          >
            Add Task
          </Button>
          <Button 
            variant="outlined"
            onClick={handleOpenDependencyDialog}
          >
            Add Dependency
          </Button>
        </Box>
      </Box>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        {timelineItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h6">No timeline items yet</Typography>
            <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
              Add equipment installations to start building your timeline
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenEquipmentDialog()}
            >
              Add Equipment
            </Button>
          </Box>
        ) : (
          <Box>
            {timelineItems.map((item, index) => (
              <TimelineItem key={item.id} item={item} index={index} />
            ))}
          </Box>
        )}
      </Paper>
      
      {/* Equipment Dialog */}
      <Dialog open={openEquipmentDialog} onClose={handleCloseEquipmentDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
        <form onSubmit={handleSubmitEquipment}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Equipment Name"
                  name="equipment_name"
                  value={equipmentFormData.equipment_name}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Equipment Type"
                  name="equipment_type"
                  value={equipmentFormData.equipment_type}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Manufacturer"
                  name="manufacturer"
                  value={equipmentFormData.manufacturer}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Model"
                  name="model"
                  value={equipmentFormData.model}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  name="serial_number"
                  value={equipmentFormData.serial_number}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location in Facility"
                  name="location_in_facility"
                  value={equipmentFormData.location_in_facility}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Planned Installation Date"
                  name="planned_installation_date"
                  type="date"
                  value={equipmentFormData.planned_installation_date}
                  onChange={handleEquipmentFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Actual Installation Date"
                  name="actual_installation_date"
                  type="date"
                  value={equipmentFormData.actual_installation_date}
                  onChange={handleEquipmentFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  name="status"
                  value={equipmentFormData.status}
                  onChange={handleEquipmentFormChange}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="ordered">Ordered</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="installed">Installed</MenuItem>
                  <MenuItem value="tested">Tested</MenuItem>
                  <MenuItem value="operational">Operational</MenuItem>
                  <MenuItem value="delayed">Delayed</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Installation Notes"
                  name="installation_notes"
                  value={equipmentFormData.installation_notes}
                  onChange={handleEquipmentFormChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEquipmentDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* Milestone Dialog */}
      <Dialog open={openMilestoneDialog} onClose={handleCloseMilestoneDialog} maxWidth="md" fullWidth>
        <DialogTitle>Add New Milestone</DialogTitle>
        <form onSubmit={handleSubmitMilestone}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Milestone Name"
                  name="name"
                  value={milestoneFormData.name}
                  onChange={handleMilestoneFormChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={milestoneFormData.description}
                  onChange={handleMilestoneFormChange}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  name="due_date"
                  type="date"
                  value={milestoneFormData.due_date}
                  onChange={handleMilestoneFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  name="status"
                  value={milestoneFormData.status}
                  onChange={handleMilestoneFormChange}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="delayed">Delayed</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseMilestoneDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* Task Dialog */}
      <Dialog open={openTaskDialog} onClose={handleCloseTaskDialog} maxWidth="md" fullWidth>
        <DialogTitle>Add New Task</DialogTitle>
        <form onSubmit={handleSubmitTask}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="Task Name"
                  name="name"
                  value={taskFormData.name}
                  onChange={handleTaskFormChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={taskFormData.description}
                  onChange={handleTaskFormChange}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  name="start_date"
                  type="date"
                  value={taskFormData.start_date}
                  onChange={handleTaskFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  name="end_date"
                  type="date"
                  value={taskFormData.end_date}
                  onChange={handleTaskFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  name="status"
                  value={taskFormData.status}
                  onChange={handleTaskFormChange}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="blocked">Blocked</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Assigned To"
                  name="assignee"
                  value={taskFormData.assignee}
                  onChange={handleTaskFormChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseTaskDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* Dependency Dialog */}
      <Dialog open={openDependencyDialog} onClose={handleCloseDependencyDialog}>
        <DialogTitle>Add Equipment Dependency</DialogTitle>
        <DialogContent>
          <Box sx={{ width: 400, pt: 2 }}>
            <TextField
              select
              fullWidth
              label="Equipment"
              value={selectedEquipment || ''}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              sx={{ mb: 2 }}
            >
              {equipmentOptions.map((equipment) => (
                <MenuItem key={equipment.installation_id} value={`equipment-${equipment.installation_id}`}>
                  {equipment.equipment_name}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              select
              fullWidth
              label="Depends On"
              value={selectedDependency || ''}
              onChange={(e) => setSelectedDependency(e.target.value)}
              disabled={!selectedEquipment}
            >
              {equipmentOptions
                .filter(equipment => 
                  selectedEquipment && 
                  `equipment-${equipment.installation_id}` !== selectedEquipment &&
                  !dependencies.some(
                    dep => 
                      dep.equipment_id === parseInt(selectedEquipment.split('-')[1]) && 
                      dep.depends_on_id === equipment.installation_id
                  )
                )
                .map((equipment) => (
                  <MenuItem key={equipment.installation_id} value={`equipment-${equipment.installation_id}`}>
                    {equipment.equipment_name}
                  </MenuItem>
                ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDependencyDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddDependency}
            disabled={!selectedEquipment || !selectedDependency}
          >
            Add Dependency
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectTimeline; 