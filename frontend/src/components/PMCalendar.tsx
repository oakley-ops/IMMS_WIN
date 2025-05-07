import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './PMCalendar.css';
import { format as formatDate, addMonths, subMonths } from 'date-fns';
import axiosInstance from '../utils/axios';
import { Modal, Button } from 'react-bootstrap';

// Interface for PM events
interface PMEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    location: string;
    status: 'overdue' | 'due' | 'scheduled' | 'in_progress';
    lastMaintenance: string | null;
  };
}

// Define ref methods that can be called by parent
export interface PMCalendarRef {
  navigateToday: () => void;
  navigateBack: () => void;
  navigateNext: () => void;
  getCurrentDate: () => Date;
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
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState('');

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
    getCurrentDate: () => currentDate
  }));

  useEffect(() => {
    fetchPMSchedule();
  }, [currentDate]);

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
      
      const formattedEvents = response.data.map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
        resource: {
          location: event.resource?.location || 'Unknown',
          status: event.resource?.status || 'scheduled',
          lastMaintenance: event.resource?.lastMaintenance || null
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
        const updatedMachine = response.data.updatedMachine;
        
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
            </tr>
          </thead>
          <tbody>
            {events.length > 0 ? (
              events.map((event, index) => {
                const isCurrentDay = formatDate(event.start, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
                const statusClass = `status-${event.resource.status}`;
                return (
                  <tr 
                    key={event.id} 
                    className={isCurrentDay ? 'current-day' : ''} 
                    onClick={() => handleMachineClick(event)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="date-column">
                      {formatDate(event.start, 'EEE MMM dd')}
                    </td>
                    <td className="time-column">
                      {event.allDay ? 'all day' : formatDate(event.start, 'HH:mm')}
                    </td>
                    <td className="event-column">
                      <div className="d-flex align-items-center">
                        <span className={`status-indicator ${event.resource.status} me-2`}></span>
                        <span>{event.title}</span>
                        <span className={`ms-2 badge ${event.resource.status}`}>{event.resource.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="text-center py-4 text-muted">
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
          <Modal.Title>Update Maintenance Status</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedMachine && (
            <div>
              <h5>{selectedMachine.title}</h5>
              <p><strong>Location:</strong> {selectedMachine.resource.location}</p>
              <p><strong>Status:</strong> <span className={`badge ${selectedMachine.resource.status}`}>{selectedMachine.resource.status}</span></p>
              <p><strong>Scheduled Date:</strong> {formatDate(selectedMachine.start, 'MMMM dd, yyyy')}</p>
              {selectedMachine.resource.lastMaintenance && (
                <p><strong>Last Maintenance:</strong> {formatDate(new Date(selectedMachine.resource.lastMaintenance), 'MMMM dd, yyyy')}</p>
              )}
              
              {statusUpdateMessage && (
                <div className={`alert ${statusUpdateMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mt-3`}>
                  {statusUpdateMessage}
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={() => updateMaintenanceStatus('in_progress')}
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Updating...' : 'Mark In Progress'}
          </Button>
          <Button 
            variant="success" 
            onClick={() => updateMaintenanceStatus('completed')}
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Updating...' : 'Mark Completed'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
});

export default PMCalendar;
