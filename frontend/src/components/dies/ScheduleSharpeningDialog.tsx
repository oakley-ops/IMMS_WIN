import React, { useState, useEffect } from 'react';
import { PRIMARY_ORANGE } from '../../theme';
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
  Autocomplete,
  Typography,
  Box,
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface ScheduleSharpeningDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDie?: any;
}

const COMMON_VENDORS = [
  'Mathias',
  'Precision Sharpening Services',
  'Die Masters Inc',
  'Sharp Edge Solutions',
  'Industrial Tool Sharpening',
  'Expert Die Service',
];

const ScheduleSharpeningDialog: React.FC<ScheduleSharpeningDialogProps> = ({
  open,
  onClose,
  onSuccess,
  preselectedDie,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dies, setDies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    die_id: '',
    sharpening_vendor: '',
    vendor_contact: '',
    vendor_phone: '',
    po_number: '',
    scheduled_date: '',
    expected_return_date: '',
    quoted_cost: '',
    condition_before: '',
    service_type: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      fetchAvailableDies();
      if (preselectedDie) {
        setFormData((prev) => ({
          ...prev,
          die_id: preselectedDie.die_id.toString(),
          condition_before: preselectedDie.status === 'NEEDS_SHARPENING' ? 'POOR' : 'FAIR',
        }));
      } else {
        resetForm();
      }
    }
  }, [open, preselectedDie]);

  const resetForm = () => {
    setFormData({
      die_id: '',
      sharpening_vendor: '',
      vendor_contact: '',
      vendor_phone: '',
      po_number: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      expected_return_date: '',
      quoted_cost: '',
      condition_before: '',
      service_type: 'Standard Sharpening',
      notes: '',
    });
    setError(null);
  };

  const fetchAvailableDies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/dies`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'NEEDS_SHARPENING' },
      });
      setDies(response.data);
    } catch (error) {
      console.error('Error fetching dies:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateReturnDate = () => {
    if (formData.scheduled_date) {
      const scheduled = new Date(formData.scheduled_date);
      scheduled.setDate(scheduled.getDate() + 7);
      handleChange('expected_return_date', scheduled.toISOString().split('T')[0]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.die_id || !formData.sharpening_vendor || !formData.scheduled_date) {
      setError('Die, vendor, and scheduled date are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        die_id: parseInt(formData.die_id),
        sharpening_vendor: formData.sharpening_vendor,
        vendor_contact: formData.vendor_contact || null,
        vendor_phone: formData.vendor_phone || null,
        po_number: formData.po_number || null,
        scheduled_date: formData.scheduled_date,
        expected_return_date: formData.expected_return_date || null,
        quoted_cost: formData.quoted_cost ? parseFloat(formData.quoted_cost) : null,
        condition_before: formData.condition_before || null,
        service_type: formData.service_type,
        notes: formData.notes || null,
      };

      await axios.post(`${API_URL}/die-sharpening`, payload, { headers });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error scheduling sharpening:', err);
      setError(err.response?.data?.error || 'Failed to schedule sharpening');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Schedule Die Sharpening</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Autocomplete
              options={dies}
              getOptionLabel={(option) =>
                `${option.die_number} - ${option.die_name} (${option.die_type})`
              }
              value={dies.find((d) => d.die_id === parseInt(formData.die_id)) || null}
              onChange={(e, value) => handleChange('die_id', value?.die_id || '')}
              disabled={!!preselectedDie}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Die *"
                  required
                  helperText={
                    dies.length === 0
                      ? 'No dies available for sharpening. Update die status first.'
                      : ''
                  }
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={COMMON_VENDORS}
              value={formData.sharpening_vendor}
              onInputChange={(e, value) => handleChange('sharpening_vendor', value)}
              renderInput={(params) => (
                <TextField {...params} label="Vendor Name *" required />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Vendor Contact Person"
              value={formData.vendor_contact}
              onChange={(e) => handleChange('vendor_contact', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Vendor Phone"
              value={formData.vendor_phone}
              onChange={(e) => handleChange('vendor_phone', e.target.value)}
              placeholder="(555) 123-4567"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="PO Number"
              value={formData.po_number}
              onChange={(e) => handleChange('po_number', e.target.value)}
              placeholder="PO-2024-####"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Scheduled Date *"
              value={formData.scheduled_date}
              onChange={(e) => handleChange('scheduled_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                type="date"
                label="Expected Return Date"
                value={formData.expected_return_date}
                onChange={(e) => handleChange('expected_return_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={calculateReturnDate}
                sx={{ minWidth: 80, mb: 0.5 }}
              >
                +7 days
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Quoted Cost"
              value={formData.quoted_cost}
              onChange={(e) => handleChange('quoted_cost', e.target.value)}
              InputProps={{ startAdornment: '$' }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Condition Before"
              value={formData.condition_before}
              onChange={(e) => handleChange('condition_before', e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value=""></option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Service Type"
              value={formData.service_type}
              onChange={(e) => handleChange('service_type', e.target.value)}
              placeholder="e.g., Standard Sharpening, Deep Grind, Polish & Sharpen"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Special instructions, expected issues, etc."
            />
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Tip:</strong> After scheduling, you can attach the PO document from the
            Sharpening Queue by clicking the paperclip icon.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || dies.length === 0}
          sx={{
            bgcolor: PRIMARY_ORANGE,
            '&:hover': { bgcolor: '#E55A00' },
          }}
        >
          {loading ? <CircularProgress size={24} /> : 'Schedule Sharpening'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleSharpeningDialog;
