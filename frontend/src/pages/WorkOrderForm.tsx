import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Container,
  Typography,
  Grid,
} from '@mui/material';
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
      <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ px: 4, py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" mb={0}>
            {isEdit ? 'Edit Work Order' : 'Create Work Order'}
          </Typography>
          <Typography variant="body2" color="text.secondary">Fill in the details below</Typography>
        </Box>
        <Button variant="outlined" color="secondary" onClick={() => navigate('/work-orders')}>
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Basic Information" titleTypographyProps={{ variant: 'h6' }} />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Title *"
                  fullWidth
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Replace conveyor belt"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Detailed description of the work to be done..."
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Work Type</InputLabel>
                  <Select
                    value={formData.work_type}
                    label="Work Type"
                    onChange={(e) => handleChange('work_type', e.target.value as WorkType)}
                  >
                    <MenuItem value="preventive">Preventive Maintenance</MenuItem>
                    <MenuItem value="corrective">Corrective</MenuItem>
                    <MenuItem value="inspection">Inspection</MenuItem>
                    <MenuItem value="emergency">Emergency</MenuItem>
                    <MenuItem value="installation">Installation</MenuItem>
                    <MenuItem value="calibration">Calibration</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => handleChange('priority', e.target.value as WorkOrderPriority)}
                  >
                    <MenuItem value="low">🟢 Low</MenuItem>
                    <MenuItem value="medium">🟡 Medium</MenuItem>
                    <MenuItem value="high">🟠 High</MenuItem>
                    <MenuItem value="critical">🔴 Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label="Estimated Hours"
                  fullWidth
                  type="number"
                  inputProps={{ step: 0.5, min: 0 }}
                  value={formData.estimated_hours || ''}
                  onChange={(e) => handleChange('estimated_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 4"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Assignment & Scheduling */}
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Assignment & Scheduling" titleTypographyProps={{ variant: 'h6' }} />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Machine Name (Optional)"
                  fullWidth
                  value={formData.machine_name || ''}
                  onChange={(e) => handleChange('machine_name', e.target.value)}
                  placeholder="e.g., Conveyor Belt #3"
                  helperText="Leave blank if not related to a specific machine"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Machine Location (Optional)"
                  fullWidth
                  value={formData.machine_location || ''}
                  onChange={(e) => handleChange('machine_location', e.target.value)}
                  placeholder="e.g., Building A, Floor 2"
                  helperText="Where is the machine located?"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Assign to Technician (Optional)</InputLabel>
                  <Select
                    value={formData.technician_name || ''}
                    label="Assign to Technician (Optional)"
                    onChange={(e) => handleChange('technician_name', e.target.value)}
                  >
                    <MenuItem value="">-- Select a technician --</MenuItem>
                    {technicians.map((tech) => (
                      <MenuItem key={tech.technician_id} value={tech.name}>
                        {tech.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Select the technician who will handle this work order</FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Scheduled Date"
                  fullWidth
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => handleChange('scheduled_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Due Date"
                  fullWidth
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Additional Notes" titleTypographyProps={{ variant: 'h6' }} />
          <CardContent>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes or instructions..."
            />
          </CardContent>
        </Card>

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/work-orders')}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ backgroundColor: 'primary.main', '&:hover': { backgroundColor: 'primary.dark' } }}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {submitting ? 'Saving...' : (isEdit ? 'Update Work Order' : 'Create Work Order')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default WorkOrderForm;
