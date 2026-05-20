import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  IconButton, Tooltip, Grid, Card, CardContent, CircularProgress
} from '@mui/material';
import { Refresh, CheckCircle, BarChart } from '@mui/icons-material';
import maintenanceCallService, { MaintenanceCall, CallMetrics } from '../services/maintenanceCallService';

const REASON_OPTIONS = [
  { value: 'mechanical', label: 'Mechanical Failure' },
  { value: 'electrical', label: 'Electrical / Controls' },
  { value: 'tooling', label: 'Tooling / Die Issue' },
  { value: 'material', label: 'Material / Feed Issue' },
  { value: 'operator_error', label: 'Operator Error' },
  { value: 'other', label: 'Other' },
];

function formatMinutes(mins: number | null): string {
  if (mins == null || mins < 0) return '—';
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `${m}m ${s}s`;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
    open: 'error', in_progress: 'warning', resolved: 'success'
  };
  return (
    <Chip
      label={status.replace('_', ' ').toUpperCase()}
      color={map[status] || 'default'}
      size="small"
      sx={{ fontWeight: 'bold' }}
    />
  );
}

const MaintenanceCalls: React.FC = () => {
  const [calls, setCalls] = useState<MaintenanceCall[]>([]);
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showMetrics, setShowMetrics] = useState(false);

  // Resolve dialog state
  const [resolving, setResolving] = useState<MaintenanceCall | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await maintenanceCallService.getCalls(statusFilter ? { status: statusFilter } : {});
      setCalls(data);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await maintenanceCallService.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    if (showMetrics) fetchMetrics();
  }, [showMetrics, fetchMetrics]);

  const openResolveDialog = (call: MaintenanceCall) => {
    setResolving(call);
    setResolutionNotes('');
    setReasonCategory('');
  };

  const handleResolve = async () => {
    if (!resolving || !resolutionNotes.trim()) return;
    setSaving(true);
    try {
      await maintenanceCallService.resolveCall(resolving.call_id, {
        reason_category: reasonCategory || undefined,
        resolution_notes: resolutionNotes,
      });
      setResolving(null);
      fetchCalls();
    } catch (err) {
      console.error('Failed to resolve call:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Maintenance Calls</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant={showMetrics ? 'contained' : 'outlined'}
            startIcon={<BarChart />}
            onClick={() => setShowMetrics(v => !v)}
          >
            Metrics
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchCalls}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Metrics panel */}
      {showMetrics && metrics && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Resolved</Typography>
                <Typography variant="h4" fontWeight="bold">{metrics.overall.total_calls}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Avg Response Time</Typography>
                <Typography variant="h5" fontWeight="bold">{metrics.overall.avg_response_minutes ?? '—'} min</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Avg Repair Time</Typography>
                <Typography variant="h5" fontWeight="bold">{metrics.overall.avg_repair_minutes ?? '—'} min</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Avg Downtime</Typography>
                <Typography variant="h5" fontWeight="bold">{metrics.overall.avg_downtime_minutes ?? '—'} min</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* By reason */}
          {metrics.by_reason.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" mb={1}>Calls by Reason</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {metrics.by_reason.map(r => (
                      <Chip
                        key={r.reason_category}
                        label={`${r.reason_category || 'unknown'}: ${r.count}`}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={e => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">{calls.length} calls</Typography>
      </Box>

      {/* Table */}
      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell><strong>#</strong></TableCell>
                <TableCell><strong>Machine</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Operator</strong></TableCell>
                <TableCell><strong>Technician</strong></TableCell>
                <TableCell><strong>Called At</strong></TableCell>
                <TableCell><strong>Response</strong></TableCell>
                <TableCell><strong>Repair</strong></TableCell>
                <TableCell><strong>Downtime</strong></TableCell>
                <TableCell><strong>Reason</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No calls found
                  </TableCell>
                </TableRow>
              ) : calls.map(call => (
                <TableRow key={call.call_id} hover>
                  <TableCell>{call.call_id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{call.machine_name}</Typography>
                    {call.machine_location && (
                      <Typography variant="caption" color="text.secondary">{call.machine_location}</Typography>
                    )}
                  </TableCell>
                  <TableCell><StatusChip status={call.status} /></TableCell>
                  <TableCell>{call.operator_name}</TableCell>
                  <TableCell>{call.technician_name || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(call.called_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(call.called_at).toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatMinutes(call.response_minutes)}</TableCell>
                  <TableCell>{formatMinutes(call.repair_minutes)}</TableCell>
                  <TableCell>{formatMinutes(call.downtime_minutes)}</TableCell>
                  <TableCell>
                    {call.reason_category ? (
                      <Chip label={call.reason_category} size="small" variant="outlined" />
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {call.status !== 'resolved' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircle />}
                        onClick={() => openResolveDialog(call)}
                      >
                        Resolve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Resolve dialog */}
      <Dialog open={!!resolving} onClose={() => setResolving(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Call — {resolving?.machine_name}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Reason Category</InputLabel>
              <Select
                value={reasonCategory}
                label="Reason Category"
                onChange={e => setReasonCategory(e.target.value)}
              >
                <MenuItem value="">— Select —</MenuItem>
                {REASON_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Resolution Notes *"
              multiline
              rows={4}
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              placeholder="What was done to resolve the issue? Parts replaced, adjustments made, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolving(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleResolve}
            disabled={!resolutionNotes.trim() || saving}
          >
            {saving ? 'Saving...' : 'Mark Resolved'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaintenanceCalls;
