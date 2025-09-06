import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Save as SaveIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axios';
import PMCalendar from './PMCalendar';
import ModalPortal from './ModalPortal';

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
  const [activeTab, setActiveTab] = useState(0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedMachineForSchedule, setSelectedMachineForSchedule] = useState<Machine | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    machine_id: '',
    machine_type: '',
    tasks: [] as PMTask[]
  });

  const [machines, setMachines] = useState<Machine[]>([]);
  const [scheduleData, setScheduleData] = useState({
    machineId: '',
    checklistId: '',
    nextMaintenanceDate: '',
    technicianName: '',
    notes: ''
  });

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
    fetchScheduleStats();
  }, []);

  const fetchScheduleStats = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/machines/pm-schedule');
      const events = response.data;
      setOverdueCount(events.filter((e: any) => e.resource?.status === 'overdue').length);
      setDueCount(events.filter((e: any) => e.resource?.status === 'due').length);
    } catch (err) {
      console.error('Error fetching schedule stats:', err);
    }
  };

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

  const handleScheduleOpen = (machine?: Machine) => {
    if (machine) {
      setSelectedMachineForSchedule(machine);
      setScheduleData(prev => ({
        ...prev,
        machineId: (machine.machine_id || machine.id)?.toString() || '',
        nextMaintenanceDate: machine.next_maintenance_date?.split('T')[0] || ''
      }));
    } else {
      setSelectedMachineForSchedule(null);
      setScheduleData({
        machineId: '',
        checklistId: '',
        nextMaintenanceDate: '',
        technicianName: '',
        notes: ''
      });
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
    if (!scheduleData.machineId || !scheduleData.nextMaintenanceDate) {
      setError('Machine and next maintenance date are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Update machine's next maintenance date
      await axiosInstance.put(`/api/v1/machines/${scheduleData.machineId}`, {
        next_maintenance_date: new Date(scheduleData.nextMaintenanceDate).toISOString()
      });

      // If checklist is selected and we want to start a session immediately
      if (scheduleData.checklistId && scheduleData.technicianName) {
        await axiosInstance.post('/api/v1/pm/sessions', {
          machineId: parseInt(scheduleData.machineId),
          checklistId: parseInt(scheduleData.checklistId),
          technicianName: scheduleData.technicianName
        });
      }

      setScheduleDialogOpen(false);
      fetchScheduleStats(); // Refresh stats
      setScheduleData({
        machineId: '',
        checklistId: '',
        nextMaintenanceDate: '',
        technicianName: '',
        notes: ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule maintenance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
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

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0">PM Management System</h1>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-primary"
                onClick={() => handleScheduleOpen()}
              >
                <i className="bi bi-calendar-plus me-2"></i>
                Schedule Maintenance
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateNew}
                style={{ backgroundColor: '#FF6600', borderColor: '#FF6600' }}
              >
                <i className="bi bi-plus-lg me-2"></i>
                Create New Checklist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-danger">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Overdue</p>
                  <h2 className="text-danger mb-0">{overdueCount}</h2>
                </div>
                <div className="text-danger">
                  <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.5rem' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-warning">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Due Soon</p>
                  <h2 className="text-warning mb-0">{dueCount}</h2>
                </div>
                <div className="text-warning">
                  <i className="bi bi-calendar-check" style={{ fontSize: '2.5rem' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-primary">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Checklists</p>
                  <h2 className="text-primary mb-0">{checklists.length}</h2>
                </div>
                <div className="text-primary">
                  <i className="bi bi-list-check" style={{ fontSize: '2.5rem' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card border-info">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Machines</p>
                  <h2 className="text-info mb-0">{machines.length}</h2>
                </div>
                <div className="text-info">
                  <i className="bi bi-gear" style={{ fontSize: '2.5rem' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-4">
        <div className="card-header p-0">
          <ul className="nav nav-tabs card-header-tabs" role="tablist">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 0 ? 'active' : ''}`}
                onClick={() => setActiveTab(0)}
                type="button"
                role="tab"
              >
                <i className="bi bi-list-check me-2"></i>
                Checklists
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 1 ? 'active' : ''}`}
                onClick={() => setActiveTab(1)}
                type="button"
                role="tab"
              >
                <i className="bi bi-calendar me-2"></i>
                Schedule
                {(overdueCount + dueCount) > 0 && (
                  <span className="badge bg-danger ms-2">{overdueCount + dueCount}</span>
                )}
              </button>
            </li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 0 && (
        <div>
          <div className="row">
            {checklists.map((checklist) => (
              <div className="col-lg-4 col-md-6 mb-4" key={checklist.checklist_id}>
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-gear-fill text-primary me-2"></i>
                      <h5 className="card-title mb-0">{checklist.name}</h5>
                    </div>
                    
                    <p className="card-text text-muted mb-2">
                      {checklist.description || 'No description'}
                    </p>

                    <div className="d-flex gap-2 mb-2">
                      <span className="badge bg-primary">{checklist.machine_type}</span>
                      <span className={`badge ${checklist.is_active ? 'bg-success' : 'bg-danger'}`}>
                        {checklist.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <small className="text-muted">
                      Updated: {new Date(checklist.updated_at).toLocaleDateString()}
                    </small>

                    <div className="mt-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => toggleShowTasks(checklist.checklist_id)}
                      >
                        <i className="bi bi-list me-1"></i>
                        {showTasks[checklist.checklist_id] ? 'Hide Tasks' : 'Show Tasks'}
                      </button>
                    </div>

                    {showTasks[checklist.checklist_id] && checklist.tasks && (
                      <div className="mt-2">
                        <hr />
                        <h6 className="mb-2">Tasks ({checklist.tasks.length})</h6>
                        <div className="list-group list-group-flush">
                          {checklist.tasks.map((task, index) => (
                            <div key={index} className="list-group-item px-0 py-1">
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <div className="fw-bold">{task.task_name}</div>
                                  <small className="text-muted">{task.task_description}</small>
                                </div>
                                {task.is_required && (
                                  <span className="badge bg-danger ms-2">Required</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleEdit(checklist)}
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(checklist)}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {checklists.length === 0 && (
            <div className="text-center py-5">
              <h5 className="text-muted">No checklists found</h5>
              <p className="text-muted">Create your first PM checklist to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 1 && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Maintenance Schedule</h4>
            <button
              className="btn btn-outline-primary"
              onClick={() => handleScheduleOpen()}
            >
              <i className="bi bi-calendar-plus me-2"></i>
              Schedule New Maintenance
            </button>
          </div>
          
          <PMCalendar 
            onDateChange={() => {}}
            defaultDate={new Date()}
          />
        </div>
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
                  const selectedMachine = machines.find(m => (m.machine_id || m.id)?.toString() === e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    machine_id: e.target.value,
                    machine_type: selectedMachine?.machine_type || ''
                  }));
                }}
                label="Select Machine"
              >
                {machines.map((machine) => (
                  <MenuItem key={machine.machine_id || machine.id} value={(machine.machine_id || machine.id)?.toString()}>
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

      {/* Schedule Maintenance Dialog */}
      <ModalPortal open={scheduleDialogOpen}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">
                Schedule Maintenance
                {selectedMachineForSchedule && (
                  <small className="text-muted d-block">
                    {selectedMachineForSchedule.name} - {selectedMachineForSchedule.model}
                  </small>
                )}
              </h5>
            </div>
            <div className="dialog-content">
              <div className="row">
                {!selectedMachineForSchedule && (
                  <div className="col-12 mb-3">
                    <label className="form-label">Select Machine *</label>
                    <select
                      className="form-control"
                      value={scheduleData.machineId}
                      onChange={(e) => setScheduleData(prev => ({ ...prev, machineId: e.target.value }))}
                      required
                    >
                      <option value="">Select a machine...</option>
                      {machines.map((machine) => (
                        <option key={machine.machine_id || machine.id} value={(machine.machine_id || machine.id)?.toString()}>
                          {machine.name} ({machine.model}) - {machine.location}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-md-6 mb-3">
                  <label className="form-label">Next Maintenance Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={scheduleData.nextMaintenanceDate}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, nextMaintenanceDate: e.target.value }))}
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Checklist (Optional)</label>
                  <select
                    className="form-control"
                    value={scheduleData.checklistId}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, checklistId: e.target.value }))}
                  >
                    <option value="">No checklist - schedule only</option>
                    {checklists.map((checklist) => (
                      <option key={checklist.checklist_id} value={checklist.checklist_id.toString()}>
                        {checklist.name} ({checklist.machine_type})
                      </option>
                    ))}
                  </select>
                </div>

                {scheduleData.checklistId && (
                  <div className="col-12 mb-3">
                    <label className="form-label">Technician Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={scheduleData.technicianName}
                      onChange={(e) => setScheduleData(prev => ({ ...prev, technicianName: e.target.value }))}
                      placeholder="Enter technician name"
                    />
                    <small className="form-text text-muted">
                      Required if starting a PM session immediately
                    </small>
                  </div>
                )}

                <div className="col-12 mb-3">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    value={scheduleData.notes}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Add any maintenance notes or special instructions..."
                  />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleScheduleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleScheduleSubmit}
                  disabled={isSubmitting}
                  style={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600' 
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <ScheduleIcon style={{ marginRight: '8px', fontSize: '16px' }} />
                      Schedule Maintenance
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  );
};

export default PMChecklistManagement; 