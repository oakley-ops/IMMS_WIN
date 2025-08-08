import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  FormControlLabel,
  Alert,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Build as BuildIcon,
  DragIndicator,
  Warning as WarningIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  List as ListIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axios';

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
  machine_id: number;
  name: string;
  model: string;
  machine_type: string;
  location: string;
  manufacturer: string;
}

interface PMTask {
  task_id?: number;
  task_name: string;
  task_description: string;
  is_required: boolean;
  order_position: number;
}

const PMChecklistManagement: React.FC = () => {
  const [checklists, setChecklists] = useState<PMChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<PMChecklist | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<PMChecklist | null>(null);
  const [showTasks, setShowTasks] = useState<{ [key: number]: boolean }>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    machine_id: '',
    machine_type: '',
    tasks: [] as PMTask[]
  });

  const [machines, setMachines] = useState<Machine[]>([]);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/v1/pm/checklists');
      setChecklists(response.data);
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
      setError('Failed to fetch machines');
    }
  };

  useEffect(() => {
    fetchChecklists();
    fetchMachines();
  }, []);

  const fetchChecklistWithTasks = async (checklistId: number) => {
    try {
      const response = await axiosInstance.get(`/api/v1/pm/checklists/${checklistId}`);
      return response.data;
    } catch (err: any) {
      console.error('Error fetching checklist with tasks:', err);
      throw err;
    }
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

  const handleEdit = async (checklist: PMChecklist) => {
    try {
      const checklistWithTasks = await fetchChecklistWithTasks(checklist.checklist_id);
      setEditingChecklist(checklist);
      setFormData({
        name: checklistWithTasks.name,
        description: checklistWithTasks.description || '',
        machine_id: '', // Will be filled by user selection
        machine_type: checklistWithTasks.machine_type,
        tasks: checklistWithTasks.tasks || []
      });
      setOpenDialog(true);
    } catch (err: any) {
      setError('Failed to load checklist for editing');
    }
  };

  const handleDelete = (checklist: PMChecklist) => {
    setChecklistToDelete(checklist);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!checklistToDelete) return;

    try {
      await axiosInstance.delete(`/api/v1/pm/checklists/${checklistToDelete.checklist_id}`);
      setChecklists(prev => prev.filter(c => c.checklist_id !== checklistToDelete.checklist_id));
      setDeleteConfirmOpen(false);
      setChecklistToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete checklist');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.machine_id) {
      setError('Name and machine selection are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const requestData = {
        name: formData.name,
        description: formData.description,
        machineType: formData.machine_type,
        tasks: formData.tasks.map(task => ({
          name: task.task_name,
          description: task.task_description,
          isRequired: task.is_required
        }))
      };

      if (editingChecklist) {
        // Update existing checklist
        await axiosInstance.put(`/api/v1/pm/checklists/${editingChecklist.checklist_id}`, requestData);
      } else {
        // Create new checklist
        await axiosInstance.post('/api/v1/pm/checklists', requestData);
      }

      setOpenDialog(false);
      fetchChecklists();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save checklist');
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
        is_required: true,
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          PM Checklist Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
        >
          Create New Checklist
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {checklists.map((checklist) => (
          <Grid item xs={12} md={6} lg={4} key={checklist.checklist_id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <BuildIcon color="primary" />
                  <Typography variant="h6" component="h2">
                    {checklist.name}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="textSecondary" mb={2}>
                  {checklist.description || 'No description'}
                </Typography>

                <Box display="flex" gap={1} mb={2}>
                  <Chip 
                    label={checklist.machine_type} 
                    color="primary" 
                    variant="outlined" 
                    size="small"
                  />
                  <Chip 
                    label={checklist.is_active ? 'Active' : 'Inactive'} 
                    color={checklist.is_active ? 'success' : 'error'}
                    variant="outlined" 
                    size="small"
                  />
                </Box>

                <Typography variant="caption" color="textSecondary">
                  Updated: {new Date(checklist.updated_at).toLocaleDateString()}
                </Typography>

                <Box mt={2}>
                  <Button
                    size="small"
                    startIcon={<ListIcon />}
                    onClick={() => toggleShowTasks(checklist.checklist_id)}
                  >
                    {showTasks[checklist.checklist_id] ? 'Hide Tasks' : 'Show Tasks'}
                  </Button>
                </Box>

                {showTasks[checklist.checklist_id] && checklist.tasks && (
                  <Box mt={2}>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Tasks ({checklist.tasks.length})
                    </Typography>
                    <List dense>
                      {checklist.tasks.map((task, index) => (
                        <ListItem key={index} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={task.task_name}
                            secondary={task.task_description}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                          {task.is_required && (
                            <Chip 
                              label="Required" 
                              color="error" 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(checklist)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  color="error"
                  onClick={() => handleDelete(checklist)}
                >
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {checklists.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="textSecondary">
            No checklists found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Create your first PM checklist to get started
          </Typography>
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingChecklist ? 'Edit Checklist' : 'Create New Checklist'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              multiline
              rows={2}
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Select Machine</InputLabel>
              <Select
                value={formData.machine_id}
                onChange={(e) => {
                  const selectedMachine = machines.find(m => m.machine_id.toString() === e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    machine_id: e.target.value,
                    machine_type: selectedMachine?.machine_type || ''
                  }));
                }}
                label="Select Machine"
              >
                {machines.map((machine) => (
                  <MenuItem key={machine.machine_id} value={machine.machine_id.toString()}>
                    {machine.name} ({machine.machine_type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box mt={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Tasks</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddTask}
                  size="small"
                >
                  Add Task
                </Button>
              </Box>

              {formData.tasks.map((task, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="subtitle2">Task {index + 1}</Typography>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveTask(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  
                  <TextField
                    fullWidth
                    label="Task Name"
                    value={task.task_name}
                    onChange={(e) => handleTaskChange(index, 'task_name', e.target.value)}
                    margin="normal"
                    size="small"
                    required
                  />
                  
                  <TextField
                    fullWidth
                    label="Task Description"
                    value={task.task_description}
                    onChange={(e) => handleTaskChange(index, 'task_description', e.target.value)}
                    margin="normal"
                    size="small"
                    multiline
                    rows={2}
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={task.is_required}
                        onChange={(e) => handleTaskChange(index, 'is_required', e.target.checked)}
                      />
                    }
                    label="Required Task"
                  />
                </Paper>
              ))}

              {formData.tasks.length === 0 && (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                  No tasks added yet. Click "Add Task" to get started.
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="error" />
            Confirm Delete
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the checklist "{checklistToDelete?.name}"? 
            This action cannot be undone.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will only deactivate the checklist. It will not affect existing PM sessions.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PMChecklistManagement; 