import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import workOrderService from '../services/workOrderService';
import { CreateWorkOrderRequest, WorkType, WorkOrderPriority } from '../types/workOrder';
import axiosInstance from '../utils/axios';

interface Technician {
  technician_id: number;
  name: string;
  active: boolean;
}

const WorkOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [formData, setFormData] = useState<CreateWorkOrderRequest>({
    title: '',
    description: '',
    work_type: 'corrective' as WorkType,
    priority: 'medium' as WorkOrderPriority,
    machine_name: '',
    machine_location: '',
    technician_name: '',
    scheduled_date: '',
    due_date: '',
    estimated_hours: undefined,
    notes: '',
    parts: [],
    tasks: []
  });

  useEffect(() => {
    fetchTechnicians();
    if (isEdit && id) {
      loadWorkOrder(parseInt(id));
    }
  }, [id, isEdit]);

  const fetchTechnicians = async () => {
    try {
      const response = await axiosInstance.get('/api/v1/technicians');
      setTechnicians(response.data || []);
    } catch (err) {
      console.error('Error fetching technicians:', err);
    }
  };

  const loadWorkOrder = async (workOrderId: number) => {
    try {
      setLoading(true);
      const wo = await workOrderService.getWorkOrderById(workOrderId);
      
      setFormData({
        title: wo.title,
        description: wo.description,
        work_type: wo.work_type,
        priority: wo.priority,
        machine_name: wo.machine_name || '',
        machine_location: wo.machine_location || '',
        technician_name: wo.technician_name || '',
        scheduled_date: wo.scheduled_date ? wo.scheduled_date.split('T')[0] : '',
        due_date: wo.due_date ? wo.due_date.split('T')[0] : '',
        estimated_hours: wo.estimated_hours,
        notes: wo.notes,
        parts: wo.parts.map(p => ({
          part_id: p.part_id,
          quantity_required: p.quantity_required,
          notes: p.notes
        })),
        tasks: wo.tasks.map(t => t.task_description)
      });
    } catch (err) {
      console.error('Error loading work order:', err);
      setError('Failed to load work order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && id) {
        await workOrderService.updateWorkOrder(parseInt(id), formData);
      } else {
        await workOrderService.createWorkOrder(formData);
      }
      navigate('/work-orders');
    } catch (err: any) {
      console.error('Error saving work order:', err);
      setError(err.response?.data?.error || 'Failed to save work order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateWorkOrderRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Container fluid className="px-4 py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="px-4 py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h2 mb-0">{isEdit ? 'Edit Work Order' : 'Create Work Order'}</h1>
              <p className="text-muted mb-0">Fill in the details below</p>
            </div>
            <Button variant="outline-secondary" onClick={() => navigate('/work-orders')}>
              Cancel
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Basic Information</h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Title *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="e.g., Replace conveyor belt"
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Detailed description of the work to be done..."
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>Work Type *</Form.Label>
                  <Form.Select
                    required
                    value={formData.work_type}
                    onChange={(e) => handleChange('work_type', e.target.value as WorkType)}
                  >
                    <option value="preventive">Preventive Maintenance</option>
                    <option value="corrective">Corrective</option>
                    <option value="inspection">Inspection</option>
                    <option value="emergency">Emergency</option>
                    <option value="installation">Installation</option>
                    <option value="calibration">Calibration</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>Priority *</Form.Label>
                  <Form.Select
                    required
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value as WorkOrderPriority)}
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="critical">🔴 Critical</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>Estimated Hours</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.estimated_hours || ''}
                    onChange={(e) => handleChange('estimated_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g., 4"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Assignment & Scheduling</h5>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Machine Name (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.machine_name || ''}
                    onChange={(e) => handleChange('machine_name', e.target.value)}
                    placeholder="e.g., Conveyor Belt #3"
                  />
                  <Form.Text className="text-muted">
                    Leave blank if not related to a specific machine
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Machine Location (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.machine_location || ''}
                    onChange={(e) => handleChange('machine_location', e.target.value)}
                    placeholder="e.g., Building A, Floor 2"
                  />
                  <Form.Text className="text-muted">
                    Where is the machine located?
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Assign to Technician (Optional)</Form.Label>
                  <Form.Select
                    value={formData.technician_name || ''}
                    onChange={(e) => handleChange('technician_name', e.target.value)}
                  >
                    <option value="">-- Select a technician --</option>
                    {technicians.map((tech) => (
                      <option key={tech.technician_id} value={tech.name}>
                        {tech.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Select the technician who will handle this work order
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Scheduled Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => handleChange('scheduled_date', e.target.value)}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Due Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => handleChange('due_date', e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">Additional Notes</h5>
          </Card.Header>
          <Card.Body>
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any additional notes or instructions..."
              />
            </Form.Group>
          </Card.Body>
        </Card>

        <div className="d-flex justify-content-end gap-2">
          <Button variant="outline-secondary" onClick={() => navigate('/work-orders')}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            disabled={submitting}
            style={{ backgroundColor: '#0066A1', borderColor: '#0066A1' }}
          >
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              isEdit ? 'Update Work Order' : 'Create Work Order'
            )}
          </Button>
        </div>
      </Form>
    </Container>
  );
};

export default WorkOrderForm;

