import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Container,
  Typography,
  Grid,
} from '@mui/material';
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
      <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !workOrder) {
    return (
      <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Work order not found'}</Alert>
        <Button onClick={() => navigate('/work-orders')}>Back to Work Orders</Button>
      </Container>
    );
  }

  const completedTasksCount = workOrder.tasks.filter(t => t.is_completed).length;
  const taskProgress = workOrder.tasks.length > 0
    ? (completedTasksCount / workOrder.tasks.length) * 100
    : 0;

  return (
    <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="h5" component="h1">{workOrder.work_order_number}</Typography>
            <Chip
              label={getStatusLabel(workOrder.status)}
              size="small"
              sx={{ backgroundColor: getStatusColor(workOrder.status), color: 'white', fontSize: '0.9rem' }}
            />
            <Chip
              label={`${getPriorityIcon(workOrder.priority)} ${getPriorityLabel(workOrder.priority)}`}
              size="small"
              sx={{ backgroundColor: getPriorityColor(workOrder.priority), color: 'white', fontSize: '0.9rem' }}
            />
          </Box>
          <Typography variant="h6" mb={0.5}>{workOrder.title}</Typography>
          <Typography variant="body2" color="text.secondary">{getWorkTypeLabel(workOrder.work_type)}</Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => navigate(`/work-orders/${workOrder.work_order_id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate('/work-orders')}
          >
            Back
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          {/* Details Card */}
          <Card sx={{ mb: 4 }}>
            <CardHeader title="Work Order Details" titleTypographyProps={{ variant: 'h6' }} />
            <CardContent>
              {workOrder.description && (
                <Box mb={3}>
                  <Typography variant="subtitle2">Description:</Typography>
                  <Typography variant="body2" mt={0.5}>{workOrder.description}</Typography>
                </Box>
              )}

              <Grid container spacing={1}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" mb={1}><strong>Machine:</strong> {workOrder.machine_name || 'Not assigned'}</Typography>
                  <Typography variant="body2" mb={1}><strong>Location:</strong> {workOrder.machine_location || '-'}</Typography>
                  <Typography variant="body2" mb={1}><strong>Assigned To:</strong> {workOrder.technician_name || 'Unassigned'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" mb={1}><strong>Scheduled:</strong> {workOrder.scheduled_date ? new Date(workOrder.scheduled_date).toLocaleDateString() : '-'}</Typography>
                  <Typography variant="body2" mb={1}><strong>Due Date:</strong> {workOrder.due_date ? new Date(workOrder.due_date).toLocaleDateString() : '-'}</Typography>
                  <Typography variant="body2" mb={1}><strong>Estimated:</strong> {workOrder.estimated_hours ? `${workOrder.estimated_hours}h` : '-'}</Typography>
                </Grid>
              </Grid>

              {workOrder.notes && (
                <Box mt={3} p={2} sx={{ backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="subtitle2">Notes:</Typography>
                  <Typography variant="body2" mt={0.5}>{workOrder.notes}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Tasks Card */}
          <Card sx={{ mb: 4 }}>
            <CardHeader
              title={`Tasks (${completedTasksCount}/${workOrder.tasks.length})`}
              titleTypographyProps={{ variant: 'h6' }}
              action={
                <LinearProgress
                  variant="determinate"
                  value={taskProgress}
                  color="success"
                  sx={{ width: 150, height: 10, borderRadius: 5, mt: 1 }}
                />
              }
            />
            <CardContent>
              {workOrder.tasks.length === 0 ? (
                <Typography color="text.secondary">No tasks defined</Typography>
              ) : (
                <List disablePadding>
                  {workOrder.tasks.map((task) => (
                    <ListItem
                      key={task.task_id}
                      sx={{ px: 0, py: 0.5, gap: 1 }}
                      disableGutters
                    >
                      <Checkbox
                        checked={task.is_completed}
                        onChange={(e) => handleTaskToggle(task.task_id, e.target.checked)}
                        size="small"
                      />
                      <ListItemText
                        primary={task.task_description}
                        primaryTypographyProps={{
                          sx: {
                            textDecoration: task.is_completed ? 'line-through' : 'none',
                            color: task.is_completed ? 'text.secondary' : 'text.primary'
                          }
                        }}
                      />
                      {task.is_completed && task.completed_by_name && (
                        <Typography variant="caption" color="text.secondary">
                          by {task.completed_by_name}
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Comments Card */}
          <Card sx={{ mb: 4 }}>
            <CardHeader title={`Comments (${workOrder.comments.length})`} titleTypographyProps={{ variant: 'h6' }} />
            <CardContent>
              {workOrder.comments.length === 0 ? (
                <Typography color="text.secondary" mb={2}>No comments yet</Typography>
              ) : (
                <Box mb={3}>
                  {workOrder.comments.map((comment) => (
                    <Box key={comment.comment_id} mb={2} p={2} sx={{ backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="subtitle2">{comment.technician_name || 'User'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(comment.created_at).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{comment.comment_text}</Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box component="form" onSubmit={handleAddComment}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  size="small"
                  sx={{ mb: 1 }}
                />
                <Button
                  type="submit"
                  size="small"
                  variant="contained"
                  disabled={submittingComment || !commentText.trim()}
                >
                  {submittingComment ? 'Posting...' : 'Add Comment'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>
          {/* Status Actions */}
          <Card sx={{ mb: 4 }}>
            <CardHeader title="Actions" titleTypographyProps={{ variant: 'h6' }} />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  sx={{ backgroundColor: '#FF6600', '&:hover': { backgroundColor: '#e65c00' }, fontWeight: 600 }}
                  startIcon={exportingPDF ? <CircularProgress size={18} color="inherit" /> : undefined}
                >
                  {exportingPDF ? 'Generating PDF...' : '📄 Print Work Order'}
                </Button>

                {workOrder.status === 'pending' && (
                  <Button variant="contained" color="success" fullWidth onClick={() => handleStatusChange('in_progress')}>
                    Start Work Order
                  </Button>
                )}
                {workOrder.status === 'in_progress' && (
                  <>
                    <Button variant="contained" color="success" fullWidth onClick={() => handleStatusChange('completed')}>
                      Mark as Completed
                    </Button>
                    <Button variant="contained" color="warning" fullWidth onClick={() => handleStatusChange('on_hold')}>
                      Put On Hold
                    </Button>
                  </>
                )}
                {workOrder.status === 'on_hold' && (
                  <Button variant="contained" fullWidth onClick={() => handleStatusChange('in_progress')}>
                    Resume Work Order
                  </Button>
                )}
                {workOrder.status !== 'cancelled' && workOrder.status !== 'completed' && (
                  <Button variant="contained" color="error" fullWidth onClick={() => handleStatusChange('cancelled')}>
                    Cancel Work Order
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Parts Card */}
          <Card sx={{ mb: 4 }}>
            <CardHeader title={`Parts Required (${workOrder.parts.length})`} titleTypographyProps={{ variant: 'h6' }} />
            <CardContent>
              {workOrder.parts.length === 0 ? (
                <Typography color="text.secondary">No parts assigned</Typography>
              ) : (
                <List disablePadding>
                  {workOrder.parts.map((part) => (
                    <ListItem key={part.wo_part_id} disableGutters sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={part.part_name}
                        secondary={part.part_number || undefined}
                      />
                      <Box display="flex" flexDirection="column" alignItems="flex-end">
                        <Chip label={`${part.quantity_required} req`} size="small" color="primary" />
                        {part.available_quantity !== undefined && (
                          <Typography variant="caption" color="text.secondary">
                            Available: {part.available_quantity}
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader title="Timeline" titleTypographyProps={{ variant: 'h6' }} />
            <CardContent>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">Created</Typography>
                <Typography variant="body2">{new Date(workOrder.created_at).toLocaleString()}</Typography>
              </Box>
              {workOrder.started_at && (
                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">Started</Typography>
                  <Typography variant="body2">{new Date(workOrder.started_at).toLocaleString()}</Typography>
                </Box>
              )}
              {workOrder.completed_at && (
                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">Completed</Typography>
                  <Typography variant="body2">{new Date(workOrder.completed_at).toLocaleString()}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default WorkOrderDetail;
