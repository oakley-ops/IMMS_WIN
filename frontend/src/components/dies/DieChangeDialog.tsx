import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface Die {
  die_id: number;
  die_number: string;
  die_type: string;
  status: string;
}

interface Machine {
  machine_id: number;
  name: string;
  location?: string;
}

interface Technician {
  technician_id: number;
  name: string;
}

interface DieChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  die: Die;
  action: 'install' | 'remove';
}

const ALL_REASON_CODES = [
  { value: 'NEW_INSTALL', label: 'New Installation' },
  { value: 'REPLACEMENT', label: 'Replacement' },
  { value: 'SCH_MAINT', label: 'Scheduled Maintenance' },
  { value: 'ROTATION', label: 'Die Rotation' },
  { value: 'UPGRADE', label: 'Upgrade' },
  { value: 'DULL', label: 'Die Dull - Needs Sharpening' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'QUALITY', label: 'Quality Issues' },
  { value: 'OTHER', label: 'Other' },
];

const DieChangeDialog: React.FC<DieChangeDialogProps> = ({
  open,
  onClose,
  onSuccess,
  die,
  action,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [formData, setFormData] = useState({
    machine_id: '',
    technician_name: '',
    change_reason_code: '',
    change_reason_notes: '',
    expected_runtime_hours: '',
    expected_cycles: '',
    actual_runtime_hours: '',
    actual_cycles: '',
    cycles_at_removal: '',
    die_condition: '',
    next_status: '',
  });

  useEffect(() => {
    if (open) {
      if (action === 'install') {
        fetchMachines();
      }
      fetchTechnicians();
      resetForm();
    }
  }, [open, action]);

  const resetForm = () => {
    setFormData({
      machine_id: '',
      technician_name: '',
      change_reason_code: '',
      change_reason_notes: '',
      expected_runtime_hours: '',
      expected_cycles: '',
      actual_runtime_hours: '',
      actual_cycles: '',
      cycles_at_removal: '',
      die_condition: '',
      next_status: '',
    });
    setError(null);
  };

  const fetchMachines = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/machines?machine_type=Die Press`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/technicians`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (action === 'install' && !formData.machine_id) {
      setError('Please select a machine');
      return;
    }

    if (!formData.change_reason_code) {
      setError('Please select a reason for this change');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // TODO: add technician_id UI field if needed by the backend
      const payload: Record<string, unknown> = {
        change_reason_code: formData.change_reason_code,
        change_reason_notes: formData.change_reason_notes,
        technician_name: formData.technician_name,
      };

      if (action === 'install') {
        payload.machine_id = parseInt(formData.machine_id);
        payload.expected_runtime_hours = formData.expected_runtime_hours
          ? parseInt(formData.expected_runtime_hours)
          : null;
        payload.expected_cycles = formData.expected_cycles
          ? parseInt(formData.expected_cycles)
          : null;

        await axios.post(`${API_URL}/dies/${die.die_id}/install`, payload, { headers });
      } else {
        payload.actual_runtime_hours = formData.actual_runtime_hours
          ? parseInt(formData.actual_runtime_hours)
          : null;
        payload.actual_cycles = formData.actual_cycles ? parseInt(formData.actual_cycles) : null;
        payload.cycles_at_removal = formData.cycles_at_removal
          ? parseInt(formData.cycles_at_removal)
          : null;
        payload.die_condition = formData.die_condition;
        payload.next_status = formData.next_status;

        await axios.post(`${API_URL}/dies/${die.die_id}/remove`, payload, { headers });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error performing die change:', err);
      setError(err.response?.data?.error || `Failed to ${action} die`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {action === 'install' ? 'Install Die in Machine' : 'Remove Die from Machine'}
      </DialogTitle>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2">
              Die: <strong>{die?.die_number}</strong> ({die?.die_type})
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {action === 'install' && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Select Machine *</InputLabel>
                  <Select
                    value={formData.machine_id}
                    label="Select Machine *"
                    onChange={(e) => handleChange('machine_id', e.target.value)}
                    required
                  >
                    <MenuItem value="">Select a machine...</MenuItem>
                    {machines.map((machine) => (
                      <MenuItem key={machine.machine_id} value={machine.machine_id}>
                        {machine.name} - {machine.location || 'No location'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Reason for Change *</InputLabel>
                <Select
                  value={formData.change_reason_code}
                  label="Reason for Change *"
                  onChange={(e) => handleChange('change_reason_code', e.target.value)}
                  required
                >
                  <MenuItem value="">Select a reason...</MenuItem>
                  {ALL_REASON_CODES.map((reason: { value: string; label: string }) => (
                    <MenuItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Technician or Operator"
                value={formData.technician_name}
                onChange={(e) => handleChange('technician_name', e.target.value)}
                inputProps={{ list: 'technicians-list' }}
                placeholder="Enter or select technician name"
              />
              <datalist id="technicians-list">
                {technicians.map((tech) => (
                  <option key={tech.technician_id} value={tech.name} />
                ))}
              </datalist>
            </Grid>

            {action === 'install' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Expected Runtime (hours)"
                    value={formData.expected_runtime_hours}
                    onChange={(e) => handleChange('expected_runtime_hours', e.target.value)}
                    placeholder="0"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Expected Cycles"
                    value={formData.expected_cycles}
                    onChange={(e) => handleChange('expected_cycles', e.target.value)}
                    placeholder="0"
                  />
                </Grid>
              </>
            )}

            {action === 'remove' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Actual Runtime (hours)"
                    value={formData.actual_runtime_hours}
                    onChange={(e) => handleChange('actual_runtime_hours', e.target.value)}
                    placeholder="0"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Actual Cycles"
                    value={formData.actual_cycles}
                    onChange={(e) => handleChange('actual_cycles', e.target.value)}
                    placeholder="0"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Total Cycles at Removal"
                    value={formData.cycles_at_removal}
                    onChange={(e) => handleChange('cycles_at_removal', e.target.value)}
                    placeholder="0"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Die Condition</InputLabel>
                    <Select
                      value={formData.die_condition}
                      label="Die Condition"
                      onChange={(e) => handleChange('die_condition', e.target.value)}
                    >
                      <MenuItem value="">Select condition...</MenuItem>
                      <MenuItem value="GOOD">Good</MenuItem>
                      <MenuItem value="FAIR">Fair</MenuItem>
                      <MenuItem value="POOR">Poor</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Next Status</InputLabel>
                    <Select
                      value={formData.next_status}
                      label="Next Status"
                      onChange={(e) => handleChange('next_status', e.target.value)}
                    >
                      <MenuItem value="">Auto (Based on Condition)</MenuItem>
                      <MenuItem value="SHARP">Sharp</MenuItem>
                      <MenuItem value="USED">Used</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Leave blank for automatic status based on condition
                  </Typography>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                label="Additional Notes"
                value={formData.change_reason_notes}
                onChange={(e) => handleChange('change_reason_notes', e.target.value)}
                placeholder="Enter any additional notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
            color={action === 'install' ? 'success' : 'error'}
          >
            {action === 'install' ? 'Install Die' : 'Remove Die'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DieChangeDialog;
