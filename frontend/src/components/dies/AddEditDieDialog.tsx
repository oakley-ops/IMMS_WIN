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
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface Machine {
  machine_id: number;
  name: string;
  machine_type?: string;
}

interface AddEditDieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  die?: any;
}

const AddEditDieDialog: React.FC<AddEditDieDialogProps> = ({
  open,
  onClose,
  onSuccess,
  die,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [formData, setFormData] = useState({
    die_number: '',
    die_type: '',
    notes: '',
    status: 'SHARP',
    compatible_machine_ids: [] as number[],
  });

  // Fetch die press machines
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/machines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filter to only show die press machines
        const diePressMachines = response.data.filter((m: Machine) =>
          m.name?.toLowerCase().includes('die press') ||
          m.machine_type?.toLowerCase().includes('die press')
        );
        setMachines(diePressMachines);
      } catch (err) {
        console.error('Error fetching machines:', err);
      }
    };
    if (open) {
      fetchMachines();
    }
  }, [open]);

  useEffect(() => {
    if (die) {
      setFormData({
        die_number: die.die_number || '',
        die_type: die.die_type || '',
        notes: die.notes || '',
        status: die.status || 'SHARP',
        compatible_machine_ids: die.compatible_machine_ids || [],
      });
    } else {
      setFormData({
        die_number: '',
        die_type: '',
        notes: '',
        status: 'SHARP',
        compatible_machine_ids: [],
      });
    }
    setError(null);
  }, [die, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMachineToggle = (machineId: number) => {
    setFormData((prev) => {
      const currentIds = prev.compatible_machine_ids || [];
      const newIds = currentIds.includes(machineId)
        ? currentIds.filter(id => id !== machineId)
        : [...currentIds, machineId];
      return { ...prev, compatible_machine_ids: newIds };
    });
  };

  const handleSubmit = async () => {
    if (!formData.die_number || !formData.die_type) {
      setError('Die number and type are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        ...formData,
        // Send null if no machines selected (means compatible with all)
        compatible_machine_ids: formData.compatible_machine_ids?.length > 0
          ? formData.compatible_machine_ids
          : null,
      };

      if (die) {
        await axios.put(`${API_URL}/dies/${die.die_id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/dies`, payload, { headers });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving die:', err);
      setError(err.response?.data?.error || 'Failed to save die');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{die ? 'Edit Die' : 'Add New Die'}</DialogTitle>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Die Number *"
                size="small"
                value={formData.die_number}
                onChange={(e) => handleChange('die_number', e.target.value)}
                placeholder="e.g., 100, 201, 305"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Die Type *</InputLabel>
                <Select
                  value={formData.die_type}
                  label="Die Type *"
                  onChange={(e) => handleChange('die_type', e.target.value)}
                >
                  <MenuItem value="">Select Type</MenuItem>
                  <MenuItem value="4 up die">4 up die</MenuItem>
                  <MenuItem value="8 up die">8 up die</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {die && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => handleChange('status', e.target.value)}
                  >
                    <MenuItem value="SHARP">Sharp</MenuItem>
                    <MenuItem value="USED">Used</MenuItem>
                    <MenuItem value="OUT_FOR_SHARPENING">Sent Out for Sharpening</MenuItem>
                    <MenuItem value="IN_MACHINE">In Machine</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                size="small"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes about this die..."
              />
            </Grid>

            {machines.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                  Compatible Machines
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Select which machines this die can be installed in. Leave empty if compatible with all.
                </Typography>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                    maxHeight: 150,
                    overflowY: 'auto',
                  }}
                >
                  <FormGroup>
                    {machines.map((machine) => (
                      <FormControlLabel
                        key={machine.machine_id}
                        control={
                          <Checkbox
                            size="small"
                            checked={formData.compatible_machine_ids?.includes(machine.machine_id) || false}
                            onChange={() => handleMachineToggle(machine.machine_id)}
                          />
                        }
                        label={machine.name}
                      />
                    ))}
                  </FormGroup>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            {die ? 'Update Die' : 'Add Die'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddEditDieDialog;
