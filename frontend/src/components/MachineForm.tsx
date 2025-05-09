import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchMachines } from '../store';
import { Machine } from '../types';

interface MachineFormData {
  name: string;
  model: string;
  serial_number: string;
  location: string;
  notes: string;
  manufacturer: string;
  status: string;
  installation_date: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
}

interface ValidationErrors {
  name?: string;
  model?: string;
  serial_number?: string;
}

const MachineForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  
  const [formData, setFormData] = useState<MachineFormData>({
    name: '',
    model: '',
    serial_number: '',
    location: '',
    notes: '',
    manufacturer: '',
    status: 'active',
    installation_date: '',
    last_maintenance_date: null,
    next_maintenance_date: ''
  });

  useEffect(() => {
    if (id) {
      fetchMachine();
    }
  }, [id]);

  const fetchMachine = async () => {
    try {
      setInitialLoading(true);
      
      // Use the real API call
      const response = await axiosInstance.get(`/api/v1/machines/${id}`);
      setFormData(response.data);
    } catch (error: any) {
      console.error('Error fetching machine:', error);
      setError(error.response?.data?.message || 'Failed to fetch machine details');
    } finally {
      setInitialLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Machine name is required';
    }
    
    if (!formData.model.trim()) {
      errors.model = 'Model number is required';
    }
    
    if (!formData.serial_number.trim()) {
      errors.serial_number = 'Serial number is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when field is edited
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Format the data for submission (ensuring types match)
    const submissionData: MachineFormData = {
      ...formData,
      installation_date: formData.installation_date || '',
      last_maintenance_date: formData.last_maintenance_date || null,
      next_maintenance_date: formData.next_maintenance_date || '',
      location: formData.location || '',
      notes: formData.notes || '',
      manufacturer: formData.manufacturer || '',
      status: formData.status || 'active'
    };

    console.log('Submitting machine data:', submissionData);

    try {
      if (id) {
        // Use real API for update
        await axiosInstance.put(`/api/v1/machines/${id}`, submissionData);
      } else {
        // Use real API for create
        const response = await axiosInstance.post('/api/v1/machines', submissionData);
        console.log('Machine created:', response.data);
      }
      
      dispatch(fetchMachines());
      setSuccess(id ? 'Machine updated successfully!' : 'Machine created successfully!');
      
      // Navigate back after a short delay
      setTimeout(() => {
        navigate('/machines');
      }, 1500);
    } catch (error: any) {
      console.error('Error saving machine:', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'Failed to save machine');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading machine details...</span>
        </Spinner>
        <p className="mt-3 text-muted">Loading machine details...</p>
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h4 mb-0">{id ? 'Edit Machine' : 'Add New Machine'}</h2>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => navigate('/machines')}
          >
            Back to Machines
          </Button>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Machine Name*</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  isInvalid={!!validationErrors.name}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.name}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Model Number*</Form.Label>
                <Form.Control
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  isInvalid={!!validationErrors.model}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.model}
                </Form.Control.Feedback>
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Serial Number*</Form.Label>
                <Form.Control
                  type="text"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleChange}
                  isInvalid={!!validationErrors.serial_number}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.serial_number}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Manufacturer</Form.Label>
                <Form.Control
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Location</Form.Label>
                <Form.Control
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Status</Form.Label>
                <Form.Control
                  type="text"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Installation Date</Form.Label>
                <Form.Control
                  type="date"
                  name="installation_date"
                  value={formData.installation_date}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Last Maintenance Date</Form.Label>
                <Form.Control
                  type="date"
                  name="last_maintenance_date"
                  value={formData.last_maintenance_date || ''}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Next Maintenance Date</Form.Label>
                <Form.Control
                  type="date"
                  name="next_maintenance_date"
                  value={formData.next_maintenance_date}
                  onChange={handleChange}
                />
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-4">
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Add any maintenance notes or special instructions..."
                />
              </Form.Group>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => navigate('/machines')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Saving...
                </>
              ) : (
                'Save Machine'
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default MachineForm;