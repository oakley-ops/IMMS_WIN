import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Container,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { PRIMARY_ORANGE, COLOR_WARNING_BG } from '../theme';
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

  const fetchWorkOrders = useCallback(async () => {
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
  }, [statusFilter, priorityFilter, workTypeFilter]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

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
      <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" mb={0}>Work Orders</Typography>
          <Typography variant="body2" color="text.secondary">Manage and track maintenance work orders</Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => navigate('/work-orders/new')}
          sx={{ backgroundColor: 'primary.main', '&:hover': { backgroundColor: 'primary.dark' } }}
        >
          + Create Work Order
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Card sx={{ mb: 4, p: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            sx={{ minWidth: 220 }}
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>All Statuses</InputLabel>
            <Select
              value={statusFilter}
              label="All Statuses"
              onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | '')}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on_hold">On Hold</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>All Priorities</InputLabel>
            <Select
              value={priorityFilter}
              label="All Priorities"
              onChange={(e) => setPriorityFilter(e.target.value as WorkOrderPriority | '')}
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>All Work Types</InputLabel>
            <Select
              value={workTypeFilter}
              label="All Work Types"
              onChange={(e) => setWorkTypeFilter(e.target.value as WorkType | '')}
            >
              <MenuItem value="">All Work Types</MenuItem>
              <MenuItem value="preventive">Preventive</MenuItem>
              <MenuItem value="corrective">Corrective</MenuItem>
              <MenuItem value="inspection">Inspection</MenuItem>
              <MenuItem value="emergency">Emergency</MenuItem>
              <MenuItem value="installation">Installation</MenuItem>
              <MenuItem value="calibration">Calibration</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Work Orders Table */}
      <Card>
        {filteredWorkOrders.length === 0 ? (
          <Box textAlign="center" py={5}>
            <Typography color="text.secondary" mb={2}>No work orders found</Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/work-orders/new')}
            >
              Create Your First Work Order
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell>WO Number</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredWorkOrders.map((wo) => (
                  <TableRow
                    key={wo.work_order_id}
                    hover
                    sx={{
                      backgroundColor: isOverdue(wo) ? COLOR_WARNING_BG : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/work-orders/${wo.work_order_id}`)}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <strong>{wo.work_order_number}</strong>
                        {isOverdue(wo) && (
                          <Chip label="Overdue" size="small" color="error" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{wo.title}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${getPriorityIcon(wo.priority)} ${getPriorityLabel(wo.priority)}`}
                        size="small"
                        sx={{ backgroundColor: getPriorityColor(wo.priority), color: 'white' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(wo.status)}
                        size="small"
                        sx={{ backgroundColor: getStatusColor(wo.status), color: 'white' }}
                      />
                    </TableCell>
                    <TableCell>{getWorkTypeLabel(wo.work_type)}</TableCell>
                    <TableCell>{wo.machine_name || '-'}</TableCell>
                    <TableCell>{wo.technician_name || 'Unassigned'}</TableCell>
                    <TableCell>
                      {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {wo.total_tasks && wo.total_tasks > 0 ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={(wo.completed_tasks! / wo.total_tasks) * 100}
                            sx={{ width: 60, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption">{wo.completed_tasks}/{wo.total_tasks}</Typography>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/work-orders/${wo.work_order_id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => handleDelete(wo.work_order_id)}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
        Showing {filteredWorkOrders.length} of {workOrders.length} work orders
      </Typography>
    </Container>
  );
};

export default WorkOrders;
