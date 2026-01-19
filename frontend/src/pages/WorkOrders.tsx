import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert, Form, InputGroup, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import workOrderService from '../services/workOrderService';
import {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkType,
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  getPriorityLabel,
  getPriorityIcon,
  getWorkTypeLabel
} from '../types/workOrder';

const WorkOrders: React.FC = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | ''>('');
  const [workTypeFilter, setWorkTypeFilter] = useState<WorkType | ''>('');

  useEffect(() => {
    fetchWorkOrders();
  }, [statusFilter, priorityFilter, workTypeFilter]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (workTypeFilter) filters.work_type = workTypeFilter;

      const data = await workOrderService.getWorkOrders(filters);
      setWorkOrders(data);
    } catch (err: any) {
      console.error('Error fetching work orders:', err);
      setError('Failed to load work orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) {
      return;
    }

    try {
      await workOrderService.deleteWorkOrder(id);
      setWorkOrders(workOrders.filter(wo => wo.work_order_id !== id));
    } catch (err) {
      console.error('Error deleting work order:', err);
      alert('Failed to delete work order');
    }
  };

  const handleStatusChange = async (id: number, newStatus: WorkOrderStatus) => {
    try {
      await workOrderService.updateWorkOrder(id, { status: newStatus });
      fetchWorkOrders();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const searchLower = searchTerm.toLowerCase();
    return (
      wo.work_order_number.toLowerCase().includes(searchLower) ||
      wo.title.toLowerCase().includes(searchLower) ||
      wo.machine_name?.toLowerCase().includes(searchLower) ||
      wo.technician_name?.toLowerCase().includes(searchLower)
    );
  });

  const isOverdue = (wo: WorkOrder) => {
    if (!wo.due_date || wo.status === 'completed' || wo.status === 'cancelled') {
      return false;
    }
    return new Date(wo.due_date) < new Date();
  };

  if (loading) {
    return (
      <Container fluid className="px-4 py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="px-4 py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h2 mb-0">Work Orders</h1>
              <p className="text-muted mb-0">Manage and track maintenance work orders</p>
            </div>
            <Button 
              variant="primary" 
              onClick={() => navigate('/work-orders/new')}
              style={{ backgroundColor: '#0066A1', borderColor: '#0066A1' }}
            >
              + Create Work Order
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <InputGroup>
                <InputGroup.Text>🔍</InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search work orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | '')}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select 
                value={priorityFilter} 
                onChange={(e) => setPriorityFilter(e.target.value as WorkOrderPriority | '')}
              >
                <option value="">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select 
                value={workTypeFilter} 
                onChange={(e) => setWorkTypeFilter(e.target.value as WorkType | '')}
              >
                <option value="">All Work Types</option>
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
                <option value="inspection">Inspection</option>
                <option value="emergency">Emergency</option>
                <option value="installation">Installation</option>
                <option value="calibration">Calibration</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <Card.Body className="p-0">
          {filteredWorkOrders.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">No work orders found</p>
              <Button 
                variant="primary" 
                onClick={() => navigate('/work-orders/new')}
              >
                Create Your First Work Order
              </Button>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead style={{ backgroundColor: '#f8f9fa' }}>
                <tr>
                  <th>WO Number</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Machine</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkOrders.map((wo) => (
                  <tr 
                    key={wo.work_order_id}
                    style={{ 
                      backgroundColor: isOverdue(wo) ? '#fff3cd' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/work-orders/${wo.work_order_id}`)}
                  >
                    <td>
                      <strong>{wo.work_order_number}</strong>
                      {isOverdue(wo) && <Badge bg="danger" className="ms-2">Overdue</Badge>}
                    </td>
                    <td>{wo.title}</td>
                    <td>
                      <Badge 
                        style={{ 
                          backgroundColor: getPriorityColor(wo.priority),
                          color: 'white'
                        }}
                      >
                        {getPriorityIcon(wo.priority)} {getPriorityLabel(wo.priority)}
                      </Badge>
                    </td>
                    <td>
                      <Badge 
                        style={{ 
                          backgroundColor: getStatusColor(wo.status),
                          color: 'white'
                        }}
                      >
                        {getStatusLabel(wo.status)}
                      </Badge>
                    </td>
                    <td>{getWorkTypeLabel(wo.work_type)}</td>
                    <td>{wo.machine_name || '-'}</td>
                    <td>{wo.technician_name || 'Unassigned'}</td>
                    <td>
                      {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      {wo.total_tasks && wo.total_tasks > 0 ? (
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress" style={{ width: '60px', height: '8px' }}>
                            <div 
                              className="progress-bar" 
                              role="progressbar" 
                              style={{ 
                                width: `${(wo.completed_tasks! / wo.total_tasks) * 100}%`,
                                backgroundColor: '#0066A1'
                              }}
                            />
                          </div>
                          <small>{wo.completed_tasks}/{wo.total_tasks}</small>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline-primary"
                          onClick={() => navigate(`/work-orders/${wo.work_order_id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-danger"
                          onClick={() => handleDelete(wo.work_order_id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <div className="mt-3 text-muted text-center">
        Showing {filteredWorkOrders.length} of {workOrders.length} work orders
      </div>
    </Container>
  );
};

export default WorkOrders;







