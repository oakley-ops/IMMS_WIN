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
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface ShipReceiveDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: any;
  action: 'ship' | 'receive';
}

const ShipReceiveDialog: React.FC<ShipReceiveDialogProps> = ({
  open,
  onClose,
  onSuccess,
  record,
  action,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    shipped_date: '',
    tracking_number_outbound: '',
    actual_return_date: '',
    tracking_number_inbound: '',
    actual_cost: '',
    condition_after: '',
    inspection_passed: true,
    inspection_notes: '',
  });

  useEffect(() => {
    if (open && record) {
      const today = new Date().toISOString().split('T')[0];
      if (action === 'ship') {
        setFormData((prev) => ({
          ...prev,
          shipped_date: today,
          tracking_number_outbound: '',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          actual_return_date: today,
          tracking_number_inbound: '',
          actual_cost: record.quoted_cost || '',
          condition_after: 'GOOD',
          inspection_passed: true,
          inspection_notes: '',
        }));
      }
      setError(null);
    }
  }, [open, record, action]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (action === 'ship') {
        if (!formData.shipped_date) {
          setError('Shipped date is required');
          setLoading(false);
          return;
        }

        await axios.put(
          `${API_URL}/die-sharpening/${record.sharpening_id}/ship`,
          {
            shipped_date: formData.shipped_date,
            tracking_number_outbound: formData.tracking_number_outbound || null,
          },
          { headers }
        );
      } else {
        if (!formData.actual_return_date) {
          setError('Return date is required');
          setLoading(false);
          return;
        }

        await axios.put(
          `${API_URL}/die-sharpening/${record.sharpening_id}/receive`,
          {
            actual_return_date: formData.actual_return_date,
            tracking_number_inbound: formData.tracking_number_inbound || null,
            actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
            condition_after: formData.condition_after,
            inspection_passed: formData.inspection_passed,
            inspection_notes: formData.inspection_notes || null,
          },
          { headers }
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(`Error ${action}ing die:`, err);
      setError(err.response?.data?.error || `Failed to ${action} die`);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (action === 'ship') return 'Ship Die to Vendor';
    if (record?.status === 'SHIPPED') return 'Mark Die at Vendor';
    return 'Receive Die from Vendor';
  };

  const getActionLabel = () => {
    if (action === 'ship') return 'Mark as Shipped';
    if (record?.status === 'SHIPPED') return 'Confirm at Vendor';
    return 'Mark as Received';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {record && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Die: <strong>{record.die_number}</strong> - {record.die_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vendor: {record.sharpening_vendor}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Expected Return: {new Date(record.expected_return_date).toLocaleDateString()}
            </Typography>
          </Box>
        )}

        <Grid container spacing={2}>
          {action === 'ship' ? (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="date"
                  label="Shipped Date *"
                  value={formData.shipped_date}
                  onChange={(e) => handleChange('shipped_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tracking Number (Outbound)"
                  value={formData.tracking_number_outbound}
                  onChange={(e) => handleChange('tracking_number_outbound', e.target.value)}
                  placeholder="e.g., 1Z999AA10123456784"
                  helperText="Optional: Tracking number for shipment to vendor"
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="date"
                  label="Return Date *"
                  value={formData.actual_return_date}
                  onChange={(e) => handleChange('actual_return_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tracking Number (Inbound)"
                  value={formData.tracking_number_inbound}
                  onChange={(e) => handleChange('tracking_number_inbound', e.target.value)}
                  placeholder="e.g., 1Z999AA10123456784"
                  helperText="Optional: Tracking number for return shipment"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Actual Cost"
                  value={formData.actual_cost}
                  onChange={(e) => handleChange('actual_cost', e.target.value)}
                  InputProps={{ startAdornment: '$' }}
                  helperText={
                    record?.quoted_cost
                      ? `Quoted: $${record.quoted_cost.toFixed(2)}`
                      : undefined
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Condition After Sharpening"
                  value={formData.condition_after}
                  onChange={(e) => handleChange('condition_after', e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Inspection Result"
                  value={formData.inspection_passed ? 'PASSED' : 'FAILED'}
                  onChange={(e) => handleChange('inspection_passed', e.target.value === 'PASSED')}
                  SelectProps={{ native: true }}
                >
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Inspection Notes"
                  value={formData.inspection_notes}
                  onChange={(e) => handleChange('inspection_notes', e.target.value)}
                  placeholder="Quality check results, any issues found, etc."
                />
              </Grid>
            </>
          )}
        </Grid>

        {action === 'receive' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Die will be marked as <strong>AVAILABLE</strong> and sharpening count will be
              incremented.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            bgcolor: action === 'ship' ? '#2196F3' : '#4CAF50',
            '&:hover': {
              bgcolor: action === 'ship' ? '#1976D2' : '#45A049',
            },
          }}
        >
          {loading ? <CircularProgress size={24} /> : getActionLabel()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShipReceiveDialog;
