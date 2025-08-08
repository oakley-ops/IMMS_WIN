import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Notes,
  Person,
  Build,
  Schedule,
  Warning
} from '@mui/icons-material';
import axiosInstance from '../utils/axios';

interface PMTask {
  task_id: number;
  task_name: string;
  task_description: string;
  is_required: boolean;
  order_position: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

interface PMSession {
  session_id: number;
  machine_id: number;
  checklist_id: number;
  technician_name: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  machine_name: string;
  machine_model: string;
  machine_location: string;
  checklist_name: string;
  checklist_description: string;
  technician_username: string | null;
  tasks: PMTask[];
}

interface Technician {
  technician_id: number;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PMChecklistDialogProps {
  open: boolean;
  onClose: () => void;
  machineId: number;
  machineName: string;
  machineModel: string;
  machineLocation: string;
  machineType: string;
  onCompleted: () => void;
}

const PMChecklistDialog: React.FC<PMChecklistDialogProps> = ({
  open,
  onClose,
  machineId,
  machineName,
  machineModel,
  machineLocation,
  machineType,
  onCompleted
}) => {
  const [session, setSession] = useState<PMSession | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [taskNotes, setTaskNotes] = useState<{[key: number]: string}>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Load technicians on mount
  useEffect(() => {
    if (open) {
      // Reset states when dialog opens for a new machine
      setError(null);
      setSession(null);
      setSelectedTechnician('');
      setCompletionNotes('');
      setTaskNotes({});
      
      fetchTechnicians();
      checkExistingSession();
    }
  }, [open, machineId]);

  const fetchTechnicians = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/technicians');
      setTechnicians(response.data);
    } catch (err: any) {
      console.error('Error fetching technicians:', err);
      setError('Failed to load technicians');
    }
  };

  const checkExistingSession = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/v1/pm/sessions/active');
      const existingSession = response.data.find((s: any) => s.machine_id === machineId);
      
      if (existingSession) {
        // Load existing session
        await loadSession(existingSession.session_id);
      } else {
        // Ensure technician selection is reset if no existing session
        setSelectedTechnician('');
      }
    } catch (err: any) {
      console.error('Error checking existing session:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const response = await axiosInstance.get(`/api/v1/pm/sessions/${sessionId}`);
      setSession(response.data);
      setSelectedTechnician(response.data.technician_name || '');
      setCompletionNotes(response.data.notes || '');
      
      // Load task notes
      const notes: {[key: number]: string} = {};
      response.data.tasks.forEach((task: PMTask) => {
        if (task.notes) {
          notes[task.task_id] = task.notes;
        }
      });
      setTaskNotes(notes);
    } catch (err: any) {
      console.error('Error loading session:', err);
      setError('Failed to load PM session');
    }
  };

  const startNewSession = async () => {
    if (!selectedTechnician) {
      setError('Please select a technician');
      return;
    }

    try {
      setIsStarting(true);
      setError(null);

      // Get checklist for this machine type
      const checklistResponse = await axiosInstance.get(`/api/v1/pm/checklists/by-machine-type/${machineType}`);
      const checklist = checklistResponse.data;

      if (!checklist) {
        setError('No checklist found for this machine type');
        return;
      }

      // Start new session
      const sessionResponse = await axiosInstance.post('/api/v1/pm/sessions', {
        machineId,
        checklistId: checklist.checklist_id,
        technicianName: selectedTechnician
      });

      // Load the created session
      await loadSession(sessionResponse.data.session_id);
      
      // Trigger a refresh of the calendar immediately after starting the session
      onCompleted();
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.response?.data?.error || 'Failed to start PM session');
    } finally {
      setIsStarting(false);
    }
  };

  const updateTaskCompletion = async (taskId: number, isCompleted: boolean) => {
    if (!session) return;

    try {
      const notes = taskNotes[taskId] || '';
      await axiosInstance.put(`/api/v1/pm/sessions/${session.session_id}/tasks/${taskId}`, {
        isCompleted,
        notes
      });

      // Update local state
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map(task =>
            task.task_id === taskId
              ? { ...task, is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }
              : task
          )
        };
      });
    } catch (err: any) {
      console.error('Error updating task completion:', err);
      setError('Failed to update task completion');
    }
  };

  const updateTaskNotes = (taskId: number, notes: string) => {
    setTaskNotes(prev => ({ ...prev, [taskId]: notes }));
  };

  const completeSession = async () => {
    if (!session) return;

    const incompleteTasks = session.tasks.filter(t => t.is_required && !t.is_completed);
    if (incompleteTasks.length > 0) {
      setError('All required tasks must be completed before finishing the PM');
      return;
    }

    try {
      setIsCompleting(true);
      setError(null);

      await axiosInstance.put(`/api/v1/pm/sessions/${session.session_id}/complete`, {
        notes: completionNotes
      });

      onCompleted();
      handleClose();
    } catch (err: any) {
      console.error('Error completing session:', err);
      setError(err.response?.data?.error || 'Failed to complete PM session');
    } finally {
      setIsCompleting(false);
    }
  };

  const calculateProgress = () => {
    if (!session) return 0;
    const completedTasks = session.tasks.filter(t => t.is_completed).length;
    return (completedTasks / session.tasks.length) * 100;
  };

  const getRequiredTasksStatus = () => {
    if (!session) return { completed: 0, total: 0 };
    const requiredTasks = session.tasks.filter(t => t.is_required);
    const completedRequired = requiredTasks.filter(t => t.is_completed);
    return { completed: completedRequired.length, total: requiredTasks.length };
  };

  const handleClose = () => {
    // If there was an active session, refresh the calendar to show updated status
    const hadActiveSession = session !== null;
    
    // Reset all state when dialog closes
    setError(null);
    setSession(null);
    setSelectedTechnician('');
    setCompletionNotes('');
    setTaskNotes({});
    setIsStarting(false);
    setIsCompleting(false);
    setLoading(false);
    
    // Call the parent's onClose handler
    onClose();
    
    // Always refresh the calendar to show any status changes
    // This ensures that starting a new PM session updates the calendar
    onCompleted();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Build color="primary" />
          <Box>
            <Typography variant="h6">
              Preventive Maintenance - {machineName}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {machineModel} • {machineLocation}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!session && !loading && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Start New PM Session
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Technician</InputLabel>
                          <Select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value as string)}
              label="Select Technician"
            >
                {technicians.map((tech) => (
                  <MenuItem key={tech.technician_id} value={tech.name}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Person fontSize="small" />
                      {tech.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={startNewSession}
              disabled={isStarting || !selectedTechnician}
              startIcon={isStarting ? <CircularProgress size={20} /> : <Build />}
            >
              {isStarting ? 'Starting...' : 'Start PM Session'}
            </Button>
          </Box>
        )}

        {session && (
          <Box>
            {/* Session Info */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                {session.checklist_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {session.checklist_description}
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mt={1}>
                <Chip
                  icon={<Person />}
                  label={session.technician_username || 'Unassigned'}
                  variant="outlined"
                />
                <Chip
                  icon={<Schedule />}
                  label={`Started: ${new Date(session.started_at).toLocaleString()}`}
                  variant="outlined"
                />
              </Box>
            </Box>

            {/* Progress */}
            <Box sx={{ mb: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1">
                  Progress: {session.tasks.filter(t => t.is_completed).length} of {session.tasks.length} tasks
                </Typography>
                <Box>
                  {(() => {
                    const { completed, total } = getRequiredTasksStatus();
                    return (
                      <Chip
                        icon={completed === total ? <CheckCircle /> : <Warning />}
                        label={`Required: ${completed}/${total}`}
                        color={completed === total ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    );
                  })()}
                </Box>
              </Box>
              <LinearProgress variant="determinate" value={calculateProgress()} />
            </Box>

            {/* Tasks List */}
            <List>
              {session.tasks.map((task) => (
                <ListItem
                  key={task.task_id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: task.is_completed ? 'action.hover' : 'background.paper'
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={task.is_completed}
                      onChange={(e) => updateTaskCompletion(task.task_id, e.target.checked)}
                      icon={<RadioButtonUnchecked />}
                      checkedIcon={<CheckCircle />}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="body1"
                          sx={{
                            textDecoration: task.is_completed ? 'line-through' : 'none',
                            color: task.is_completed ? 'text.secondary' : 'text.primary'
                          }}
                        >
                          {task.task_name}
                        </Typography>
                        {task.is_required && (
                          <Chip label="Required" size="small" color="error" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          {task.task_description}
                        </Typography>
                        {task.is_completed && task.completed_at && (
                          <Typography variant="caption" color="success.main">
                            Completed: {new Date(task.completed_at).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Add notes">
                      <IconButton
                        onClick={() => {
                          const notes = prompt('Task notes:', taskNotes[task.task_id] || '');
                          if (notes !== null) {
                            updateTaskNotes(task.task_id, notes);
                          }
                        }}
                      >
                        <Notes />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {/* Completion Notes */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Completion Notes"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {session && (
          <Button
            variant="contained"
            onClick={completeSession}
            disabled={isCompleting}
            startIcon={isCompleting ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {isCompleting ? 'Completing...' : 'Complete PM'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PMChecklistDialog; 