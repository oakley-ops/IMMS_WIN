import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './PMCalendar.css';
import { format as formatDate, addMonths, subMonths } from 'date-fns';
import axiosInstance from '../utils/axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import PMChecklistDialog from './PMChecklistDialog';

// Interface for PM events
interface PMEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  technician_name?: string; // Added for technician name from API
  session_started_at?: string; // Added for session start time
  resource: {
    location: string;
    machineType: string;
    status: 'overdue' | 'due' | 'scheduled' | 'in_progress' | 'not_scheduled';
    lastMaintenance: string | null;
    technicianName?: string; // Added for technician name
  };
}

// Define ref methods that can be called by parent
export interface PMCalendarRef {
  navigateToday: () => void;
  navigateBack: () => void;
  navigateNext: () => void;
  getCurrentDate: () => Date;
  refreshSchedule: () => void;
}

interface PMChecklist {
  checklist_id: number;
  name: string;
  machine_type: string;
  description?: string;
}

interface Technician {
  technician_id: number;
  name: string;
}

interface PMCalendarProps {
  onDateChange?: (date: Date) => void;
  defaultDate?: Date;
}

const PMCalendar = forwardRef<PMCalendarRef, PMCalendarProps>(({
  onDateChange,
  defaultDate
}, ref) => {
  const [events, setEvents] = useState<PMEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(defaultDate || new Date());
  const [selectedMachine, setSelectedMachine] = useState<PMEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState('');

  // Edit schedule state
  const [checklists, setChecklists] = useState<PMChecklist[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [editScheduleDate, setEditScheduleDate] = useState('');
  const [editChecklistId, setEditChecklistId] = useState<number | ''>('');
  const [editTechnicianName, setEditTechnicianName] = useState('');

  // Update internal state when props change
  useEffect(() => {
    if (defaultDate) {
      setCurrentDate(defaultDate);
    }
  }, [defaultDate]);

  // Expose methods to parent component through ref
  useImperativeHandle(ref, () => ({
    navigateToday: () => handleNavigate('today'),
    navigateBack: () => handleNavigate('back'),
    navigateNext: () => handleNavigate('next'),
    getCurrentDate: () => currentDate,
    refreshSchedule: () => fetchPMSchedule()
  }));

  useEffect(() => {
    fetchPMSchedule();
  }, [currentDate]);

  // Fetch checklists and technicians when component mounts
  useEffect(() => {
    const fetchChecklistsAndTechnicians = async () => {
      try {
        const [checklistsRes, techniciansRes] = await Promise.all([
          axiosInstance.get('/api/v1/pm/checklists'),
          axiosInstance.get('/api/v1/technicians')
        ]);
        setChecklists(checklistsRes.data);
        setTechnicians(techniciansRes.data);
      } catch (err) {
        console.error('Error fetching checklists/technicians:', err);
      }
    };
    fetchChecklistsAndTechnicians();
  }, []);

  const handleNavigate = (action: 'back' | 'next' | 'today') => {
    let newDate: Date;
    switch (action) {
      case 'back':
        newDate = subMonths(currentDate, 1);
        break;
      case 'next':
        newDate = addMonths(currentDate, 1);
        break;
      case 'today':
        newDate = new Date();
        break;
      default:
        return;
    }
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const fetchPMSchedule = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get<PMEvent[]>('/api/v1/machines/pm-schedule');

      console.log('PM schedule API response:', response.data);

      const formattedEvents = response.data.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
        resource: {
          location: event.resource?.location || 'Unknown',
          machineType: event.machine_type || 'Default',
          status: event.resource?.status || 'scheduled',
          lastMaintenance: event.resource?.lastMaintenance || null,
          technicianName: event.technician_name || null // Map technician_name from API
        }
      }));

      // Debug counts for status types
      const overdueCount = formattedEvents.filter(e => e.resource.status === 'overdue').length;
      const dueCount = formattedEvents.filter(e => e.resource.status === 'due').length;
      const scheduledCount = formattedEvents.filter(e => e.resource.status === 'scheduled').length;

      console.log(`Frontend status counts - Overdue: ${overdueCount}, Due: ${dueCount}, Scheduled: ${scheduledCount}`);

      setEvents(formattedEvents);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching PM schedule:', err);
      setError(err.toString());
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMachineClick = (event: PMEvent) => {
    console.log('Selected machine:', event);
    setSelectedMachine(event);
    setShowModal(true);
    setStatusUpdateMessage('');
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMachine(null);
    setStatusUpdateMessage('');
  };

  const updateMaintenanceStatus = async (status: 'completed' | 'in_progress') => {
    if (!selectedMachine) {
      console.error('No machine selected');
      setStatusUpdateMessage('Error: No machine selected');
      return;
    }

    try {
      setUpdatingStatus(true);
      setStatusUpdateMessage('');

      console.log('Updating maintenance status for machine:', selectedMachine.id, 'to', status);

      // Make sure id is a valid number
      const machineId = typeof selectedMachine.id === 'number'
        ? selectedMachine.id
        : parseInt(String(selectedMachine.id), 10);

      if (isNaN(machineId)) {
        throw new Error(`Invalid machine ID: ${selectedMachine.id}`);
      }

      // Call API to update the maintenance status
      const response = await axiosInstance.post(`/api/v1/machines/${machineId}/maintenance-status`, {
        status,
        maintenanceDate: status === 'completed' ? new Date() : null
      });

      console.log('Maintenance status update response:', response.data);

      setStatusUpdateMessage(`Maintenance status updated to ${status === 'completed' ? 'Completed' : 'In Progress'}`);

      // If completed, remove it from the UI immediately
      if (status === 'completed') {
        setEvents(prev => prev.filter(event => event.id !== machineId));
      } else if (response.data.updatedMachine) {
        setEvents(prev => {
          // Find and update the specific event
          return prev.map(event => {
            if (event.id === machineId) {
              return {
                ...event,
                resource: {
                  ...event.resource,
                  status: 'in_progress' as const
                }
              };
            }
            return event;
          });
        });
      }

      // Also refresh from the server after a short delay
      setTimeout(async () => {
        await fetchPMSchedule();
      }, 1000);

      // Close the modal after a delay
      setTimeout(() => {
        closeModal();
      }, 1500);

    } catch (err: any) {
      console.error('Error updating maintenance status:', err);

      // Extract the most useful error message
      let errorMessage = 'Unknown error';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setStatusUpdateMessage(`Error updating status: ${errorMessage}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const deleteScheduledMaintenance = async () => {
    if (!selectedMachine) {
      console.error('No machine selected');
      setStatusUpdateMessage('Error: No machine selected');
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel the scheduled maintenance for ${selectedMachine.title}?`)) {
      return;
    }

    try {
      setUpdatingStatus(true);
      setStatusUpdateMessage('');

      console.log('Deleting scheduled maintenance for machine:', selectedMachine.id);

      // Make sure id is a valid number
      const machineId = typeof selectedMachine.id === 'number'
        ? selectedMachine.id
        : parseInt(String(selectedMachine.id), 10);

      if (isNaN(machineId)) {
        throw new Error(`Invalid machine ID: ${selectedMachine.id}`);
      }

      // Call API to delete the scheduled maintenance
      const response = await axiosInstance.delete(`/api/v1/machines/${machineId}/scheduled-maintenance`);

      console.log('Delete scheduled maintenance response:', response.data);

      setStatusUpdateMessage('Scheduled maintenance cancelled successfully');

      // Remove it from the UI immediately
      setEvents(prev => prev.filter(event => event.id !== machineId));

      // Also refresh from the server after a short delay
      setTimeout(async () => {
        await fetchPMSchedule();
      }, 1000);

      // Close the modal after a delay
      setTimeout(() => {
        closeModal();
      }, 1500);

    } catch (err: any) {
      console.error('Error deleting scheduled maintenance:', err);

      // Extract the most useful error message
      let errorMessage = 'Unknown error';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setStatusUpdateMessage(`Error cancelling maintenance: ${errorMessage}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openEditScheduleModal = () => {
    if (!selectedMachine) return;

    // Pre-populate the edit form with current values
    const scheduleDate = selectedMachine.resource.status !== 'not_scheduled'
      ? formatDate(selectedMachine.start, 'yyyy-MM-dd')
      : formatDate(new Date(), 'yyyy-MM-dd');
    setEditScheduleDate(scheduleDate);
    setEditTechnicianName(selectedMachine.resource.technicianName || '');

    // Auto-select checklist based on machine type
    const matchingChecklist = checklists.find(
      c => c.machine_type === selectedMachine.resource.machineType
    );
    setEditChecklistId(matchingChecklist?.checklist_id || '');

    setShowEditModal(true);
    setShowModal(false);
  };

  const saveEditedSchedule = async () => {
    if (!selectedMachine || !editScheduleDate || !editChecklistId) {
      setStatusUpdateMessage('Please fill in all required fields');
      return;
    }

    try {
      setUpdatingStatus(true);
      setStatusUpdateMessage('');

      const machineId = typeof selectedMachine.id === 'number'
        ? selectedMachine.id
        : parseInt(String(selectedMachine.id), 10);

      if (isNaN(machineId)) {
        throw new Error(`Invalid machine ID: ${selectedMachine.id}`);
      }

      // Use either PUT (update) or POST (new schedule) depending on current status
      const isNewSchedule = selectedMachine.resource.status === 'not_scheduled';

      if (isNewSchedule) {
        await axiosInstance.post('/api/v1/pm/schedule', {
          machineId,
          checklistId: editChecklistId,
          nextMaintenanceDate: editScheduleDate,
          technicianName: editTechnicianName || null
        });
      } else {
        await axiosInstance.put(`/api/v1/pm/schedule/${machineId}`, {
          checklistId: editChecklistId,
          nextMaintenanceDate: editScheduleDate,
          technicianName: editTechnicianName || null
        });
      }

      setStatusUpdateMessage(isNewSchedule ? 'Maintenance scheduled successfully' : 'Schedule updated successfully');

      // Refresh the schedule
      await fetchPMSchedule();

      // Close the modal after a delay
      setTimeout(() => {
        setShowEditModal(false);
        setStatusUpdateMessage('');
      }, 1500);

    } catch (err: any) {
      console.error('Error saving schedule:', err);
      let errorMessage = 'Unknown error';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setStatusUpdateMessage(`Error: ${errorMessage}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const startPMSession = () => {
    if (!selectedMachine) return;
    setShowModal(false);
    setShowChecklistDialog(true);
  };

  return (
    <div className="pm-calendar-container">
      <div className="pm-calendar-header">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" sx={{ color: '#FF6200', fontWeight: 600, fontSize: '1.1rem' }}>
            Preventive Maintenance
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" className="current-month">
              {formatDate(currentDate, 'MMMM yyyy')}
            </Typography>
            <div className="calendar-nav-buttons">
              <button className="calendar-nav-button today btn-sm" onClick={() => handleNavigate('today')}>Today</button>
              <button className="calendar-nav-button btn-sm" onClick={() => handleNavigate('back')}>«</button>
              <button className="calendar-nav-button btn-sm" onClick={() => handleNavigate('next')}>»</button>
            </div>
          </Box>
        </Box>

        <div className="pm-status-indicators">
          <div className="status-indicator-item">
            <span className="status-count overdue">{events.filter(event => event.resource.status === 'overdue').length}</span>
            <span className="status-label">Overdue</span>
          </div>
          <div className="status-indicator-item">
            <span className="status-count due-soon">{events.filter(event => event.resource.status === 'due').length}</span>
            <span className="status-label">Due</span>
          </div>
          <div className="status-indicator-item">
            <span className="status-count in_progress">{events.filter(event => event.resource.status === 'in_progress').length}</span>
            <span className="status-label">In Progress</span>
          </div>
          <div className="status-indicator-item">
            <span className="status-count scheduled">{events.filter(event => event.resource.status === 'scheduled').length}</span>
            <span className="status-label">Scheduled</span>
          </div>
          <div className="status-indicator-item">
            <span className="status-count not_scheduled">{events.filter(event => event.resource.status === 'not_scheduled').length}</span>
            <span className="status-label">Not Scheduled</span>
          </div>
        </div>
      </div>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      ) : error ? (
        <Box textAlign="center" py={4}>
          <Typography color="error">{error}</Typography>
        </Box>
      ) : (
        <table className="pm-calendar-table">
          <thead>
            <tr>
              <th className="date-header">Date</th>
              <th className="time-header">Time</th>
              <th className="event-header">Event</th>
              <th className="tech-header">Technician</th>
            </tr>
          </thead>
          <tbody>
            {events.length > 0 ? (
              events.map((event) => {
                const isCurrentDay = formatDate(event.start, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
                const isNotScheduled = event.resource.status === 'not_scheduled';
                return (
                  <tr
                    key={event.id}
                    className={isCurrentDay && !isNotScheduled ? 'current-day' : ''}
                    onClick={() => handleMachineClick(event)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="date-column">
                      {isNotScheduled ? (
                        <span style={{ color: '#999' }}>Not Set</span>
                      ) : (
                        formatDate(event.start, 'EEE MMM dd')
                      )}
                    </td>
                    <td className="time-column">
                      {isNotScheduled ? '-' : (event.allDay ? 'all day' : formatDate(event.start, 'HH:mm'))}
                    </td>
                    <td className="event-column">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`status-indicator ${event.resource.status}`} style={{ marginRight: '8px' }}></span>
                        <span>{event.title}</span>
                        <span className={`ms-2 badge ${event.resource.status}`} style={{ marginLeft: '8px' }}>
                          {event.resource.status === 'not_scheduled' ? 'not scheduled' : event.resource.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="tech-column">
                      {event.resource.technicianName ? (
                        <span className="technician-name">
                          {event.resource.technicianName}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  No maintenance schedules found. Make sure machines have next maintenance dates set.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Maintenance Status Update Modal */}
      <Dialog open={showModal} onClose={closeModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedMachine?.resource.status === 'not_scheduled'
            ? 'Schedule Maintenance'
            : 'Update Maintenance Status'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedMachine && (
            <Box>
              <Typography variant="h6" gutterBottom>{selectedMachine.title}</Typography>
              <Typography variant="body2" mb={0.5}><strong>Location:</strong> {selectedMachine.resource.location}</Typography>
              <Typography variant="body2" mb={0.5}><strong>Machine Type:</strong> {selectedMachine.resource.machineType || 'Default'}</Typography>
              <Typography variant="body2" mb={0.5}>
                <strong>Status:</strong>{' '}
                <span className={`badge ${selectedMachine.resource.status}`}>
                  {selectedMachine.resource.status === 'not_scheduled'
                    ? 'not scheduled'
                    : selectedMachine.resource.status.replace('_', ' ')}
                </span>
              </Typography>
              {selectedMachine.resource.status !== 'not_scheduled' && (
                <Typography variant="body2" mb={0.5}><strong>Scheduled Date:</strong> {formatDate(selectedMachine.start, 'MMMM dd, yyyy')}</Typography>
              )}
              {selectedMachine.resource.lastMaintenance && (
                <Typography variant="body2" mb={0.5}><strong>Last Maintenance:</strong> {formatDate(new Date(selectedMachine.resource.lastMaintenance), 'MMMM dd, yyyy')}</Typography>
              )}

              {selectedMachine.resource.status === 'not_scheduled' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This machine has no scheduled maintenance. Click "Schedule" to set up a maintenance schedule.
                </Alert>
              )}

              {selectedMachine.resource.technicianName && (
                <Typography variant="body2" mb={0.5}><strong>Assigned Technician:</strong> {selectedMachine.resource.technicianName}</Typography>
              )}

              {statusUpdateMessage && (
                <Alert severity={statusUpdateMessage.includes('Error') ? 'error' : 'success'} sx={{ mt: 2 }}>
                  {statusUpdateMessage}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box display="flex" gap={1}>
            <Button variant="outlined" color="secondary" onClick={closeModal}>
              Close
            </Button>
            {selectedMachine?.resource.status !== 'not_scheduled' && (
              <Button
                variant="outlined"
                color="error"
                onClick={deleteScheduledMaintenance}
                disabled={updatingStatus}
              >
                {updatingStatus ? 'Cancelling...' : 'Cancel Schedule'}
              </Button>
            )}
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              onClick={openEditScheduleModal}
              disabled={updatingStatus}
            >
              {selectedMachine?.resource.status === 'not_scheduled' ? 'Schedule' : 'Edit Schedule'}
            </Button>
            {selectedMachine?.resource.status !== 'not_scheduled' && (
              <Button
                variant="contained"
                onClick={startPMSession}
                disabled={updatingStatus}
              >
                Start PM Now
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Edit/Schedule Maintenance Modal */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedMachine?.resource.status === 'not_scheduled'
            ? 'Schedule Maintenance'
            : 'Edit Schedule'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedMachine && (
            <Box>
              <Typography variant="h6" mb={0.5}>{selectedMachine.title}</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Type: {selectedMachine.resource.machineType || 'Default'}
              </Typography>

              <TextField
                type="date"
                label="Maintenance Date *"
                fullWidth
                sx={{ mb: 2 }}
                value={editScheduleDate}
                onChange={(e) => setEditScheduleDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: formatDate(new Date(), 'yyyy-MM-dd') }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Checklist *</InputLabel>
                <Select
                  value={editChecklistId}
                  label="Checklist *"
                  onChange={(e) => setEditChecklistId(e.target.value ? Number(e.target.value) : '')}
                >
                  <MenuItem value="">Select a checklist...</MenuItem>
                  {checklists
                    .filter(c => c.machine_type === selectedMachine.resource.machineType || c.machine_type === 'Default')
                    .map(checklist => (
                      <MenuItem key={checklist.checklist_id} value={checklist.checklist_id}>
                        {checklist.name} ({checklist.machine_type})
                      </MenuItem>
                    ))}
                  {/* Show all other checklists as well */}
                  {checklists
                    .filter(c => c.machine_type !== selectedMachine.resource.machineType && c.machine_type !== 'Default')
                    .map(checklist => (
                      <MenuItem key={checklist.checklist_id} value={checklist.checklist_id}>
                        {checklist.name} ({checklist.machine_type})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Assign Technician (Optional)</InputLabel>
                <Select
                  value={editTechnicianName}
                  label="Assign Technician (Optional)"
                  onChange={(e) => setEditTechnicianName(e.target.value)}
                >
                  <MenuItem value="">No technician assigned</MenuItem>
                  {technicians.map(tech => (
                    <MenuItem key={tech.technician_id} value={tech.name}>
                      {tech.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {statusUpdateMessage && (
                <Alert severity={statusUpdateMessage.includes('Error') ? 'error' : 'success'} sx={{ mt: 1 }}>
                  {statusUpdateMessage}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveEditedSchedule}
            disabled={updatingStatus || !editScheduleDate || !editChecklistId}
          >
            {updatingStatus ? 'Saving...' : 'Save Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New PM Checklist Dialog */}
      {selectedMachine && (
        <PMChecklistDialog
          open={showChecklistDialog}
          onClose={() => setShowChecklistDialog(false)}
          machineId={selectedMachine.id}
          machineName={selectedMachine.title.split(' (')[0]}
          machineModel={selectedMachine.title.includes('(') ? selectedMachine.title.split('(')[1].replace(')', '') : ''}
          machineLocation={selectedMachine.resource.location}
          machineType={selectedMachine.resource.machineType}
          onCompleted={() => {
            setShowChecklistDialog(false);
            fetchPMSchedule(); // Refresh the calendar
          }}
        />
      )}
    </div>
  );
});

export default PMCalendar;
