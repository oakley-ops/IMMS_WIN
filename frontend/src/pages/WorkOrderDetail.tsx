import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert, ListGroup, Form, ProgressBar } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import workOrderService from '../services/workOrderService';
import {
  WorkOrderDetail as WorkOrderDetailType,
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  getPriorityLabel,
  getPriorityIcon,
  getWorkTypeLabel
} from '../types/workOrder';

const WorkOrderDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (id) {
      fetchWorkOrder(parseInt(id));
    }
  }, [id]);

  const fetchWorkOrder = async (workOrderId: number) => {
    try {
      setLoading(true);
      const data = await workOrderService.getWorkOrderById(workOrderId);
      setWorkOrder(data);
    } catch (err) {
      console.error('Error fetching work order:', err);
      setError('Failed to load work order');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = async (taskId: number, isCompleted: boolean) => {
    if (!workOrder) return;

    try {
      await workOrderService.updateTask(workOrder.work_order_id, taskId, isCompleted);
      fetchWorkOrder(workOrder.work_order_id);
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workOrder || !commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await workOrderService.addComment(workOrder.work_order_id, commentText);
      setCommentText('');
      fetchWorkOrder(workOrder.work_order_id);
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!workOrder) return;

    try {
      if (newStatus === 'in_progress') {
        await workOrderService.startWorkOrder(workOrder.work_order_id);
      } else if (newStatus === 'completed') {
        await workOrderService.completeWorkOrder(workOrder.work_order_id);
      } else {
        await workOrderService.updateWorkOrder(workOrder.work_order_id, { status: newStatus as any });
      }
      fetchWorkOrder(workOrder.work_order_id);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleExportPDF = async () => {
    if (!workOrder) return;

    try {
      setExportingPDF(true);
      await workOrderService.exportWorkOrderPDF(workOrder.work_order_id);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
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

  if (error || !workOrder) {
    return (
      <Container fluid className="px-4 py-4">
        <Alert variant="danger">{error || 'Work order not found'}</Alert>
        <Button onClick={() => navigate('/work-orders')}>Back to Work Orders</Button>
      </Container>
    );
  }

  const completedTasksCount = workOrder.tasks.filter(t => t.is_completed).length;
  const taskProgress = workOrder.tasks.length > 0 
    ? (completedTasksCount / workOrder.tasks.length) * 100 
    : 0;

  return (
    <Container fluid className="px-4 py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <h1 className="h3 mb-0">{workOrder.work_order_number}</h1>
                <Badge 
                  style={{ 
                    backgroundColor: getStatusColor(workOrder.status),
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                >
                  {getStatusLabel(workOrder.status)}
                </Badge>
                <Badge 
                  style={{ 
                    backgroundColor: getPriorityColor(workOrder.priority),
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                >
                  {getPriorityIcon(workOrder.priority)} {getPriorityLabel(workOrder.priority)}
                </Badge>
              </div>
              <h2 className="h4 mb-1">{workOrder.title}</h2>
              <p className="text-muted mb-0">{getWorkTypeLabel(workOrder.work_type)}</p>
            </div>
            <div className="d-flex gap-2">
              <Button 
                variant="outline-primary"
                onClick={() => navigate(`/work-orders/${workOrder.work_order_id}/edit`)}
              >
                Edit
              </Button>
              <Button 
                variant="outline-secondary"
                onClick={() => navigate('/work-orders')}
              >
                Back
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      <Row>
        {/* Left Column */}
        <Col md={8}>
          {/* Details Card */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Work Order Details</h5>
            </Card.Header>
            <Card.Body>
              {workOrder.description && (
                <div className="mb-3">
                  <strong>Description:</strong>
                  <p className="mt-1">{workOrder.description}</p>
                </div>
              )}

              <Row>
                <Col md={6}>
                  <p className="mb-2"><strong>Machine:</strong> {workOrder.machine_name || 'Not assigned'}</p>
                  <p className="mb-2"><strong>Location:</strong> {workOrder.machine_location || '-'}</p>
                  <p className="mb-2"><strong>Assigned To:</strong> {workOrder.technician_name || 'Unassigned'}</p>
                </Col>
                <Col md={6}>
                  <p className="mb-2"><strong>Scheduled:</strong> {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : '-'}</p>
                  <p className="mb-2"><strong>Due Date:</strong> {workOrder.due_date ? new Date(workOrder.due_date).toLocaleDateString() : '-'}</p>
                  <p className="mb-2"><strong>Estimated:</strong> {workOrder.estimated_hours ? `${workOrder.estimated_hours}h` : '-'}</p>
                </Col>
              </Row>

              {workOrder.notes && (
                <div className="mt-3 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>Notes:</strong>
                  <p className="mt-1 mb-0">{workOrder.notes}</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Tasks Card */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Tasks ({completedTasksCount}/{workOrder.tasks.length})</h5>
              <ProgressBar 
                now={taskProgress} 
                style={{ width: '150px', height: '10px' }}
                variant="success"
              />
            </Card.Header>
            <Card.Body>
              {workOrder.tasks.length === 0 ? (
                <p className="text-muted mb-0">No tasks defined</p>
              ) : (
                <ListGroup>
                  {workOrder.tasks.map((task) => (
                    <ListGroup.Item 
                      key={task.task_id}
                      className="d-flex align-items-center gap-3"
                    >
                      <Form.Check
                        type="checkbox"
                        checked={task.is_completed}
                        onChange={(e) => handleTaskToggle(task.task_id, e.target.checked)}
                      />
                      <span style={{ 
                        textDecoration: task.is_completed ? 'line-through' : 'none',
                        color: task.is_completed ? '#6c757d' : 'inherit',
                        flex: 1
                      }}>
                        {task.task_description}
                      </span>
                      {task.is_completed && task.completed_by_name && (
                        <small className="text-muted">by {task.completed_by_name}</small>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>

          {/* Comments Card */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Comments ({workOrder.comments.length})</h5>
            </Card.Header>
            <Card.Body>
              {workOrder.comments.length === 0 ? (
                <p className="text-muted">No comments yet</p>
              ) : (
                <div className="mb-3">
                  {workOrder.comments.map((comment) => (
                    <div key={comment.comment_id} className="mb-3 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <div className="d-flex justify-content-between mb-1">
                        <strong>{comment.technician_name || 'User'}</strong>
                        <small className="text-muted">
                          {new Date(comment.created_at).toLocaleString()}
                        </small>
                      </div>
                      <p className="mb-0">{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              )}

              <Form onSubmit={handleAddComment}>
                <Form.Group className="mb-2">
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                  />
                </Form.Group>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? 'Posting...' : 'Add Comment'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column */}
        <Col md={4}>
          {/* Status Actions */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Actions</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button 
                  variant="primary" 
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  style={{ backgroundColor: '#FF6600', borderColor: '#FF6600', fontWeight: 600 }}
                >
                  {exportingPDF ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      📄 Print Work Order
                    </>
                  )}
                </Button>
                
                {workOrder.status === 'pending' && (
                  <Button variant="success" onClick={() => handleStatusChange('in_progress')}>
                    Start Work Order
                  </Button>
                )}
                {workOrder.status === 'in_progress' && (
                  <>
                    <Button variant="success" onClick={() => handleStatusChange('completed')}>
                      Mark as Completed
                    </Button>
                    <Button variant="warning" onClick={() => handleStatusChange('on_hold')}>
                      Put On Hold
                    </Button>
                  </>
                )}
                {workOrder.status === 'on_hold' && (
                  <Button variant="primary" onClick={() => handleStatusChange('in_progress')}>
                    Resume Work Order
                  </Button>
                )}
                {workOrder.status !== 'cancelled' && workOrder.status !== 'completed' && (
                  <Button variant="danger" onClick={() => handleStatusChange('cancelled')}>
                    Cancel Work Order
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Parts Card */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Parts Required ({workOrder.parts.length})</h5>
            </Card.Header>
            <Card.Body>
              {workOrder.parts.length === 0 ? (
                <p className="text-muted mb-0">No parts assigned</p>
              ) : (
                <ListGroup>
                  {workOrder.parts.map((part) => (
                    <ListGroup.Item key={part.wo_part_id}>
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{part.part_name}</strong>
                          {part.part_number && (
                            <div className="text-muted small">{part.part_number}</div>
                          )}
                        </div>
                        <Badge bg="primary">{part.quantity_required} req</Badge>
                      </div>
                      {part.available_quantity !== undefined && (
                        <small className="text-muted">
                          Available: {part.available_quantity}
                        </small>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>

          {/* Timeline Card */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Timeline</h5>
            </Card.Header>
            <Card.Body>
              <div className="timeline">
                <div className="mb-3">
                  <small className="text-muted">Created</small>
                  <div>{new Date(workOrder.created_at).toLocaleString()}</div>
                </div>
                {workOrder.started_at && (
                  <div className="mb-3">
                    <small className="text-muted">Started</small>
                    <div>{new Date(workOrder.started_at).toLocaleString()}</div>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div className="mb-3">
                    <small className="text-muted">Completed</small>
                    <div>{new Date(workOrder.completed_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default WorkOrderDetail;

