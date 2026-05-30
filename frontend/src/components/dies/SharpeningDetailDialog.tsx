import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Grid,
  Divider,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Schedule,
  LocalShipping,
  Build,
  CheckCircle,
  AttachMoney,
  CalendarToday,
  Business,
  Phone,
  Notes,
  Timer,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface SharpeningDetailDialogProps {
  open: boolean;
  onClose: () => void;
  sharpeningId: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  SCHEDULED: { label: 'Scheduled', color: '#FF9800', icon: Schedule },
  SHIPPED: { label: 'Shipped', color: '#2196F3', icon: LocalShipping },
  AT_VENDOR: { label: 'At Vendor', color: '#9C27B0', icon: Build },
  RETURNED: { label: 'Completed', color: '#4CAF50', icon: CheckCircle },
};

const SharpeningDetailDialog: React.FC<SharpeningDetailDialogProps> = ({
  open,
  onClose,
  sharpeningId,
}) => {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sharpeningId) {
      fetchRecord();
    }
  }, [open, sharpeningId]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/die-sharpening/${sharpeningId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecord(response.data);
    } catch (error) {
      console.error('Error fetching sharpening record:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return `$${amount.toFixed(2)}`;
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, color: '#9E9E9E', icon: Schedule };
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!record) {
    return null;
  }

  const status = getStatusConfig(record.status);
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Die #{record.die_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {record.die_name} - {record.die_type}
            </Typography>
          </Box>
          <Chip
            icon={<StatusIcon sx={{ color: 'white !important' }} />}
            label={status.label}
            sx={{
              bgcolor: status.color,
              color: 'white',
              fontWeight: 'bold',
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Vendor Information */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business fontSize="small" /> Vendor Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Vendor</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.sharpening_vendor || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Contact</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.vendor_contact || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Phone</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.vendor_phone || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">PO Number</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.po_number || '-'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Timeline / Dates */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday fontSize="small" /> Timeline
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Scheduled Date</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDate(record.scheduled_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Shipped Date</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDate(record.shipped_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Expected Return</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDate(record.expected_return_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Actual Return</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDate(record.actual_return_date)}
              </Typography>
            </Grid>
            {record.turnaround_days && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timer fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>Turnaround:</strong> {record.turnaround_days} days
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Cost Information */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney fontSize="small" /> Cost Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Quoted Cost</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatCurrency(record.quoted_cost)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Actual Cost</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color: record.actual_cost ? '#4CAF50' : 'inherit' }}>
                {formatCurrency(record.actual_cost)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Service & Condition */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Build fontSize="small" /> Service Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Service Type</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.service_type || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Condition Before</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.condition_before || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Condition After</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.condition_after || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Inspection</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {record.inspection_passed === true ? (
                  <Chip label="Passed" size="small" sx={{ bgcolor: '#4CAF50', color: 'white' }} />
                ) : record.inspection_passed === false ? (
                  <Chip label="Failed" size="small" sx={{ bgcolor: '#F44336', color: 'white' }} />
                ) : (
                  '-'
                )}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Notes */}
        {(record.notes || record.inspection_notes) && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notes fontSize="small" /> Notes
            </Typography>
            {record.notes && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">General Notes</Typography>
                <Typography variant="body2">{record.notes}</Typography>
              </Box>
            )}
            {record.inspection_notes && (
              <Box>
                <Typography variant="caption" color="text.secondary">Inspection Notes</Typography>
                <Typography variant="body2">{record.inspection_notes}</Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Tracking Numbers */}
        {(record.tracking_number_outbound || record.tracking_number_inbound) && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalShipping fontSize="small" /> Tracking Numbers
            </Typography>
            <Grid container spacing={2}>
              {record.tracking_number_outbound && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Outbound</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {record.tracking_number_outbound}
                  </Typography>
                </Grid>
              )}
              {record.tracking_number_inbound && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Inbound</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {record.tracking_number_inbound}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#FF6B35' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharpeningDetailDialog;
