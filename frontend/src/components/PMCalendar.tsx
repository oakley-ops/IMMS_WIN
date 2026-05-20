import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './PMCalendar.css';
import { format as formatDate, addMonths, subMonths } from 'date-fns';
import axiosInstance from '../utils/axios';
import { Modal, Button, Form } from 'react-bootstrap';
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
        // For in-progress, update the event with the new status
        // const updatedMachine = response.data.updatedMachine;
        
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
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="pm-calendar-title" style={{ color: '#FF6200', fontSize: '1.1rem' }}>Preventive Maintenance</h2>
          <div className="calendar-controls d-flex align-items-center">
            <div className="current-month">
              {formatDate(currentDate, 'MMMM yyyy')}
            </div>
            <div className="calendar-nav-buttons">
              <button className="calendar-nav-button today btn-sm" onClick={() => handleNavigate('today')}>Today</button>
              <button className="calendar-nav-button btn-sm" onClick={() => handleNavigate('back')}>«</button>
              <button className="calendar-nav-button btn-sm" onClick={() => handleNavigate('next')}>»</button>
            </div>
          </div>
        </div>
        
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
        <div className="text-center py-4">Loading...</div>
      ) : error ? (
        <div className="text-center py-4 text-danger">{error}</div>
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
              events.map((event, index) => {
                const isCurrentDay = formatDate(event.start, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
                const isNotScheduled = event.resource.status === 'not_scheduled';
                // const statusClass = `status-${event.resource.status}`;
                return (
                  <tr
                    key={event.id}
                    className={isCurrentDay && !isNotScheduled ? 'current-day' : ''}
                    onClick={() => handleMachineClick(event)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="date-column">
                      {isNotScheduled ? (
                        <span className="text-muted">Not Set</span>
                      ) : (
                        formatDate(event.start, 'EEE MMM dd')
                      )}
                    </td>
                    <td className="time-column">
                      {isNotScheduled ? '-' : (event.allDay ? 'all day' : formatDate(event.start, 'HH:mm'))}
                    </td>
                    <td className="event-column">
                      <div className="d-flex align-items-center">
                        <span className={`status-indicator ${event.resource.status} me-2`}></span>
                        <span>{event.title}</span>
                        <span className={`ms-2 badge ${event.resource.status}`}>
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
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-muted">
                  No maintenance schedules found. Make sure machines have next maintenance dates set.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Maintenance Status Update Modal */}
      <Modal show={showModal} onHide={closeModal} className="maintenance-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedMachine?.resource.status === 'not_scheduled'
              ? 'Schedule Maintenance'
              : 'Update Maintenance Status'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedMachine && (
            <div>
              <h5>{selectedMachine.title}</h5>
              <p><strong>Location:</strong> {selectedMachine.resource.location}</p>
              <p><strong>Machine Type:</strong> {selectedMachine.resource.machineType || 'Default'}</p>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`badge ${selectedMachine.resource.status}`}>
                  {selectedMachine.resource.status === 'not_scheduled'
                    ? 'not scheduled'
                    : selectedMachine.resource.status.replace('_', ' ')}
                </span>
              </p>
              {selectedMachine.resource.status !== 'not_scheduled' && (
                <p><strong>Scheduled Date:</strong> {formatDate(selectedMachine.start, 'MMMM dd, yyyy')}</p>
              )}
              {selectedMachine.resource.lastMaintenance && (
                <p><strong>Last Maintenance:</strong> {formatDate(new Date(selectedMachine.resource.lastMaintenance), 'MMMM dd, yyyy')}</p>
              )}

              {selectedMachine.resource.status === 'not_scheduled' && (
                <div className="alert alert-info mt-3">
                  This machine has no scheduled maintenance. Click "Schedule" to set up a maintenance schedule.
                </div>
              )}

              {selectedMachine.resource.technicianName && (
                <p><strong>Assigned Technician:</strong> {selectedMachine.resource.technicianName}</p>
              )}

              {statusUpdateMessage && (
                <div className={`alert ${statusUpdateMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mt-3`}>
                  {statusUpdateMessage}
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between flex-wrap">
          <div>
            <Button variant="secondary" onClick={closeModal} className="me-2">
              Close
            </Button>
            {selectedMachine?.resource.status !== 'not_scheduled' && (
              <Button
                variant="outline-danger"
                onClick={deleteScheduledMaintenance}
                disabled={updatingStatus}
                className="me-2"
              >
                {updatingStatus ? 'Cancelling...' : 'Cancel Schedule'}
              </Button>
            )}
          </div>
          <div>
            <Button
              variant="outline-primary"
              onClick={openEditScheduleModal}
              disabled={updatingStatus}
              className="me-2"
            >
              {selectedMachine?.resource.status === 'not_scheduled' ? 'Schedule' : 'Edit Schedule'}
            </Button>
            {selectedMachine?.resource.status !== 'not_scheduled' && (
              <Button
                variant="primary"
                onClick={startPMSession}
                disabled={updatingStatus}
              >
                Start PM Now
              </Button>
            )}
          </div>
        </Modal.Footer>
      </Modal>

      {/* Edit/Schedule Maintenance Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} className="edit-schedule-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedMachine?.resource.status === 'not_scheduled'
              ? 'Schedule Maintenance'
              : 'Edit Schedule'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedMachine && (
            <div>
              <h5 className="mb-3">{selectedMachine.title}</h5>
              <p className="text-muted mb-3">Type: {selectedMachine.resource.machineType || 'Default'}</p>

              <Form.Group className="mb-3">
                <Form.Label>Maintenance Date *</Form.Label>
                <Form.Control
                  type="date"
                  value={editScheduleDate}
                  onChange={(e) => setEditScheduleDate(e.target.value)}
                  min={formatDate(new Date(), 'yyyy-MM-dd')}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Checklist *</Form.Label>
                <Form.Select
                  value={editChecklistId}
                  onChange={(e) => setEditChecklistId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select a checklist...</option>
                  {checklists
                    .filter(c => c.machine_type === selectedMachine.resource.machineType || c.machine_type === 'Default')
                    .map(checklist => (
                      <option key={checklist.checklist_id} value={checklist.checklist_id}>
                        {checklist.name} ({checklist.machine_type})
                      </option>
                    ))}
                  {/* Show all other checklists as well */}
                  {checklists
                    .filter(c => c.machine_type !== selectedMachine.resource.machineType && c.machine_type !== 'Default')
                    .map(checklist => (
                      <option key={checklist.checklist_id} value={checklist.checklist_id}>
                        {checklist.name} ({checklist.machine_type})
                      </option>
                    ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Assign Technician (Optional)</Form.Label>
                <Form.Select
                  value={editTechnicianName}
                  onChange={(e) => setEditTechnicianName(e.target.value)}
                >
                  <option value="">No technician assigned</option>
                  {technicians.map(tech => (
                    <option key={tech.technician_id} value={tech.name}>
                      {tech.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {statusUpdateMessage && (
                <div className={`alert ${statusUpdateMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mt-3`}>
                  {statusUpdateMessage}
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveEditedSchedule}
            disabled={updatingStatus || !editScheduleDate || !editChecklistId}
          >
            {updatingStatus ? 'Saving...' : 'Save Schedule'}
          </Button>
        </Modal.Footer>
      </Modal>

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
