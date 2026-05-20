'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, IconButton, Tooltip, Grid,
  Card, CardContent, CircularProgress, Alert, Tabs, Tab, List, ListItem,
  ListItemText, Divider, InputAdornment,
} from '@mui/material';
import { Refresh, CheckCircle, BarChart, Badge, Add, Edit, Search, Delete } from '@mui/icons-material';
import svc, { MaintenanceCall, BadgeRegistration, CallMetrics, PartResult } from '../services/maintenanceCallService';
import { MCS_ORANGE, STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_RESOLVED, STATUS_SUSPENDED } from '../theme';

const REASON_OPTIONS = [
  { value: 'mechanical',    label: 'Mechanical Failure' },
  { value: 'electrical',   label: 'Electrical / Controls' },
  { value: 'tooling',      label: 'Tooling / Die Issue' },
  { value: 'material',     label: 'Material / Feed Issue' },
  { value: 'operator_error', label: 'Operator Error' },
  { value: 'other',        label: 'Other' },
];

function fmtSecs(secs: string | number | null): string {
  if (!secs || Number(secs) <= 0) return '—';
  const m = Math.floor(Number(secs) / 60);
  const s = Math.round(Number(secs) % 60);
  return `${m}m ${s}s`;
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    open:        { label: 'WAITING',     color: STATUS_OPEN },
    in_progress: { label: 'IN PROGRESS', color: STATUS_IN_PROGRESS },
    suspended:   { label: 'SUSPENDED',   color: STATUS_SUSPENDED },
    resolved:    { label: 'RESOLVED',    color: STATUS_RESOLVED },
  };
  const { label, color } = cfg[status] || { label: status, color: '#9E9E9E' };
  return <Chip label={label} size="small" sx={{ bgcolor: color, color: 'white', fontWeight: 700, fontSize: '0.7rem' }} />;
}

// ─── Calls Tab ────────────────────────────────────────────────────────────────

function CallsTab() {
  const [calls, setCalls] = useState<MaintenanceCall[]>([]);
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showMetrics, setShowMetrics] = useState(false);
  const [resolving, setResolving] = useState<MaintenanceCall | null>(null);
  const [resNotes, setResNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [partResults, setPartResults] = useState<PartResult[]>([]);
  const [partsUsed, setPartsUsed] = useState<{ part_id: number; part_name: string; part_number: string; quantity: number }[]>([]);
  const searchTimer = React.useRef<NodeJS.Timeout | null>(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.getCalls(statusFilter ? { status: statusFilter } : undefined);
      setCalls(data);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => {
    fetchCalls();
    const poll = setInterval(fetchCalls, 10000);
    return () => clearInterval(poll);
  }, [fetchCalls]);

  useEffect(() => {
    if (showMetrics) svc.getMetrics().then(setMetrics).catch(() => {});
  }, [showMetrics]);

  const handlePartSearch = (q: string) => {
    setPartSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setPartResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { setPartResults(await svc.searchParts(q)); } catch { /* ignore */ }
    }, 300);
  };

  const addPart = (p: PartResult) => {
    setPartsUsed(prev => {
      const existing = prev.find(x => x.part_id === p.part_id);
      if (existing) return prev.map(x => x.part_id === p.part_id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { part_id: p.part_id, part_name: p.name, part_number: p.fiserv_part_number || p.manufacturer_part_number || '', quantity: 1 }];
    });
    setPartSearch('');
    setPartResults([]);
  };

  const clearResolveDialog = () => {
    setResolving(null);
    setPartResults([]);
    setPartsUsed([]);
    setPartSearch('');
  };

  const handleResolve = async () => {
    if (!resolving || !resNotes.trim()) return;
    setSaving(true);
    try {
      await svc.resolveCall(resolving.call_id, { reason_category: reason || undefined, resolution_notes: resNotes });
      if (partsUsed.length > 0) await svc.logParts(resolving.call_id, partsUsed);
      clearResolveDialog();
      fetchCalls();
    } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="open">Waiting</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">{calls.length} calls</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant={showMetrics ? 'contained' : 'outlined'} startIcon={<BarChart />}
            onClick={() => setShowMetrics(v => !v)}
            sx={{ color: showMetrics ? 'white' : MCS_ORANGE, borderColor: MCS_ORANGE, bgcolor: showMetrics ? MCS_ORANGE : undefined }}>
            Metrics
          </Button>
          <Tooltip title="Refresh"><IconButton onClick={fetchCalls}><Refresh /></IconButton></Tooltip>
        </Box>
      </Box>

      {showMetrics && metrics && (
        <Box mb={3}>
          <Grid container spacing={2} mb={2}>
            {[
              { label: 'Total Resolved',  value: metrics.overall.total_calls },
              { label: 'Avg Response',    value: `${metrics.overall.avg_response_minutes ?? '—'} min` },
              { label: 'Avg Repair',      value: `${metrics.overall.avg_repair_minutes ?? '—'} min` },
              { label: 'Avg Downtime',    value: `${metrics.overall.avg_downtime_minutes ?? '—'} min` },
              { label: 'Total Downtime',  value: `${metrics.overall.total_downtime_hours ?? '—'} hrs` },
            ].map(({ label, value }) => (
              <Grid item xs={6} md={2.4} key={label}>
                <Card>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight="bold">{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            {metrics.by_reason.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card><CardContent>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>By Reason</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {metrics.by_reason.map(r => (
                      <Chip key={r.reason_category} label={`${r.reason_category}: ${r.count}`} variant="outlined" size="small" />
                    ))}
                  </Box>
                </CardContent></Card>
              </Grid>
            )}
            {metrics.by_shift.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card><CardContent>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>By Shift</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {metrics.by_shift.map(s => (
                      <Chip key={s.shift_name} label={`${s.shift_name}: ${s.call_count} calls`} variant="outlined" size="small" />
                    ))}
                  </Box>
                </CardContent></Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress sx={{ color: MCS_ORANGE }} /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                {['#', 'Machine', 'Status', 'Operator', 'Technician', 'Called', 'Shift', 'Response', 'Repair', 'Downtime', 'Reason', ''].map(h => (
                  <TableCell key={h}><strong>{h}</strong></TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.length === 0 ? (
                <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4, color: 'text.secondary' }}>No calls found</TableCell></TableRow>
              ) : calls.map(call => (
                <TableRow key={call.call_id} hover>
                  <TableCell>{call.call_id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{call.machine_name}</Typography>
                    {call.machine_location && <Typography variant="caption" color="text.secondary" display="block">{call.machine_location}</Typography>}
                  </TableCell>
                  <TableCell><StatusChip status={call.status} /></TableCell>
                  <TableCell>{call.operator_name}</TableCell>
                  <TableCell>{call.technician_name || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(call.called_at).toLocaleDateString()}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(call.called_at).toLocaleTimeString()}</Typography>
                  </TableCell>
                  <TableCell>{call.shift_name || '—'}</TableCell>
                  <TableCell>{fmtSecs(call.response_seconds)}</TableCell>
                  <TableCell>{fmtSecs(call.repair_seconds)}</TableCell>
                  <TableCell>{fmtSecs(call.downtime_seconds)}</TableCell>
                  <TableCell>{call.reason_category ? <Chip label={call.reason_category} size="small" variant="outlined" /> : '—'}</TableCell>
                  <TableCell>
                    {call.status !== 'resolved' && (
                      <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                        onClick={() => { setResolving(call); setResNotes(''); setReason(''); setPartsUsed([]); setPartSearch(''); setPartResults([]); }}>
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

      <Dialog open={!!resolving} onClose={clearResolveDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Call — {resolving?.machine_name}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Reason Category</InputLabel>
              <Select value={reason} label="Reason Category" onChange={e => setReason(e.target.value)}>
                <MenuItem value="">— Select —</MenuItem>
                {REASON_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Parts Used (optional)</Typography>
            <TextField fullWidth size="small" placeholder="Search by part name or number..."
              value={partSearch} onChange={e => handlePartSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
            {partResults.length > 0 && (
              <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 180, overflow: 'auto', mt: -1 }}>
                {partResults.map(p => (
                  <ListItem key={p.part_id} button onClick={() => addPart(p)}>
                    <ListItemText primary={p.name}
                      secondary={`${p.fiserv_part_number || p.manufacturer_part_number || '—'}  •  Qty: ${p.quantity}`} />
                  </ListItem>
                ))}
              </List>
            )}
            {partsUsed.length > 0 && (
              <Box>
                {partsUsed.map(p => (
                  <Box key={p.part_id} display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography variant="body2" flex={1}>
                      {p.part_name} <span style={{ color: '#999' }}>({p.part_number || '—'})</span>
                    </Typography>
                    <TextField type="number" size="small" value={p.quantity}
                      onChange={e => setPartsUsed(prev => prev.map(x => x.part_id === p.part_id
                        ? { ...x, quantity: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                      sx={{ width: 70 }} inputProps={{ min: 1 }} />
                    <IconButton size="small" onClick={() => setPartsUsed(prev => prev.filter(x => x.part_id !== p.part_id))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            <TextField label="Resolution Notes *" multiline rows={3} value={resNotes}
              onChange={e => setResNotes(e.target.value)} placeholder="What was done to resolve the issue?" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearResolveDialog}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleResolve}
            disabled={!resNotes.trim() || saving} sx={{ minWidth: 140 }}>
            {saving ? 'Saving...' : 'Mark Resolved'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Badge Admin Tab ──────────────────────────────────────────────────────────

function BadgesTab() {
  const [badges, setBadges] = useState<BadgeRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<BadgeRegistration | null>(null);
  const [form, setForm] = useState({ badge_id: '', person_name: '', role: 'operator' as 'operator' | 'technician' });
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const bufRef = React.useRef('');
  const lastKeyRef = React.useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBadges(await svc.getBadges()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyRef.current > 2000) bufRef.current = '';
      lastKeyRef.current = now;
      if (e.key === 'Enter') {
        const id = bufRef.current.trim();
        bufRef.current = '';
        if (id.length > 3) { setForm(f => ({ ...f, badge_id: id })); setCapturing(false); }
        return;
      }
      if (e.key.length === 1) bufRef.current += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capturing]);

  const save = async () => {
    setError('');
    try {
      if (editing) await svc.updateBadge(editing.badge_id, form);
      else await svc.registerBadge({ badge_id: form.badge_id, person_name: form.person_name, role: form.role });
      setDialog(false);
      load();
    } catch (e: any) { setError(e?.response?.data?.error || 'Save failed'); }
  };

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<Add />} sx={{ bgcolor: MCS_ORANGE }}
          onClick={() => { setEditing(null); setForm({ badge_id: '', person_name: '', role: 'operator' }); setDialog(true); }}>
          Register Badge
        </Button>
      </Box>
      <Paper>
        {loading ? <Box display="flex" justifyContent="center" p={3}><CircularProgress sx={{ color: MCS_ORANGE }} /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                {['Badge ID', 'Name', 'Role', 'Status', ''].map(h => <TableCell key={h}><strong>{h}</strong></TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {badges.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No badges registered</TableCell></TableRow>
              ) : badges.map(b => (
                <TableRow key={b.badge_id} hover>
                  <TableCell><code>{b.badge_id}</code></TableCell>
                  <TableCell>{b.person_name}</TableCell>
                  <TableCell><Chip label={b.role} size="small" color={b.role === 'technician' ? 'primary' : 'default'} /></TableCell>
                  <TableCell><Chip label={b.active ? 'Active' : 'Inactive'} size="small" color={b.active ? 'success' : 'default'} /></TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => { setEditing(b); setForm({ badge_id: b.badge_id, person_name: b.person_name, role: b.role }); setDialog(true); }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Badge' : 'Register Badge'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Box display="flex" gap={1}>
              <TextField label="Badge ID *" value={form.badge_id} fullWidth disabled={!!editing}
                onChange={e => setForm(f => ({ ...f, badge_id: e.target.value }))}
                sx={{ input: { bgcolor: capturing ? '#fffde7' : undefined } }}
                placeholder={capturing ? 'Scan badge now...' : 'Scan or type badge ID'} />
              {!editing && (
                <Button variant={capturing ? 'contained' : 'outlined'} color={capturing ? 'warning' : 'primary'}
                  onClick={() => setCapturing(v => !v)} sx={{ whiteSpace: 'nowrap', minWidth: 110 }}>
                  {capturing ? 'Scanning...' : 'Scan Badge'}
                </Button>
              )}
            </Box>
            <TextField label="Person Name *" value={form.person_name} fullWidth onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select value={form.role} label="Role *" onChange={e => setForm(f => ({ ...f, role: e.target.value as 'operator' | 'technician' }))}>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.badge_id || !form.person_name} sx={{ bgcolor: MCS_ORANGE }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const MaintenanceCalls: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Box sx={{ width: 6, height: 40, bgcolor: MCS_ORANGE, borderRadius: 1 }} />
        <Typography variant="h4" fontWeight="bold">Maintenance Call System</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Call History" />
        <Tab icon={<Badge fontSize="small" />} iconPosition="start" label="Badges" />
      </Tabs>

      {tab === 0 && <CallsTab />}
      {tab === 1 && <BadgesTab />}
    </Box>
  );
};

export default MaintenanceCalls;
