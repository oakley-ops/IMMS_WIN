'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { Add, Edit, Badge, Router } from '@mui/icons-material';
import svc from '../services/maintenanceCallService';
import type { BadgeRegistration, BadgeReader } from '../services/maintenanceCallService';

interface Machine { machine_id: number; name: string; }

const MCS_BASE = process.env.NEXT_PUBLIC_MCS_URL || 'http://localhost:3003';

export default function BadgeAdmin() {
  const [tab, setTab] = useState(0);
  const [badges, setBadges] = useState<BadgeRegistration[]>([]);
  const [readers, setReaders] = useState<BadgeReader[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Badge dialog
  const [badgeDialog, setBadgeDialog] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeRegistration | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    badge_id: '', person_name: '', role: 'operator' as 'operator' | 'technician', technician_id: '',
  });

  // Reader dialog
  const [readerDialog, setReaderDialog] = useState(false);
  const [editReader, setEditReader] = useState<BadgeReader | null>(null);
  const [readerForm, setReaderForm] = useState({ reader_key: '', machine_id: '', location_label: '' });

  // HID badge capture
  const [capturingBadge, setCapturingBadge] = useState(false);
  const bufferRef = React.useRef('');
  const lastKeyRef = React.useRef(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, m] = await Promise.all([
        svc.getBadges(),
        svc.getReaders(),
        svc.getMachines(),
      ]);
      setBadges(b);
      setReaders(r);
      setMachines(m);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // HID keyboard capture for badge registration
  useEffect(() => {
    if (!capturingBadge) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyRef.current > 500) bufferRef.current = '';
      lastKeyRef.current = now;
      if (e.key === 'Enter') {
        const badge = bufferRef.current.trim();
        bufferRef.current = '';
        if (badge.length > 3) {
          setBadgeForm(f => ({ ...f, badge_id: badge }));
          setCapturingBadge(false);
        }
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [capturingBadge]);

  const openNewBadge = () => {
    setEditBadge(null);
    setBadgeForm({ badge_id: '', person_name: '', role: 'operator', technician_id: '' });
    setBadgeDialog(true);
  };

  const openEditBadge = (b: BadgeRegistration) => {
    setEditBadge(b);
    setBadgeForm({ badge_id: b.badge_id, person_name: b.person_name, role: b.role, technician_id: b.technician_id?.toString() || '' });
    setBadgeDialog(true);
  };

  const saveBadge = async () => {
    setError('');
    try {
      const payload = {
        badge_id: badgeForm.badge_id,
        person_name: badgeForm.person_name,
        role: badgeForm.role,
        technician_id: badgeForm.technician_id ? parseInt(badgeForm.technician_id) : undefined,
      };
      if (editBadge) {
        await svc.updateBadge(editBadge.badge_id, payload);
      } else {
        await svc.registerBadge(payload);
      }
      setSuccess('Badge saved');
      setBadgeDialog(false);
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Failed to save badge');
    }
  };

  const openNewReader = () => {
    setEditReader(null);
    setReaderForm({ reader_key: '', machine_id: '', location_label: '' });
    setReaderDialog(true);
  };

  const openEditReader = (r: BadgeReader) => {
    setEditReader(r);
    setReaderForm({ reader_key: r.reader_key, machine_id: r.machine_id?.toString() || '', location_label: r.location_label || '' });
    setReaderDialog(true);
  };

  const saveReader = async () => {
    setError('');
    try {
      const payload = {
        reader_key: readerForm.reader_key,
        machine_id: parseInt(readerForm.machine_id),
        location_label: readerForm.location_label,
      };
      if (editReader) {
        await svc.updateReader(editReader.reader_id, payload);
      } else {
        await svc.registerReader(payload);
      }
      setSuccess('Reader saved');
      setReaderDialog(false);
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Failed to save reader');
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>Badge &amp; Reader Admin</Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Badge />} iconPosition="start" label={`Badges (${badges.length})`} />
        <Tab icon={<Router />} iconPosition="start" label={`Readers (${readers.length})`} />
      </Tabs>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : tab === 0 ? (

        /* ── Badges tab ── */
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={openNewBadge}>Register Badge</Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Badge ID</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {badges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No badges registered yet
                    </TableCell>
                  </TableRow>
                ) : badges.map(b => (
                  <TableRow key={b.badge_id} hover>
                    <TableCell><code>{b.badge_id}</code></TableCell>
                    <TableCell>{b.person_name}</TableCell>
                    <TableCell>
                      <Chip label={b.role} size="small" color={b.role === 'technician' ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={b.active ? 'Active' : 'Inactive'} size="small" color={b.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditBadge(b)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>

      ) : (

        /* ── Readers tab ── */
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={openNewReader}>Register Reader</Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Reader Key</strong></TableCell>
                  <TableCell><strong>Machine</strong></TableCell>
                  <TableCell><strong>Location Label</strong></TableCell>
                  <TableCell><strong>Station URL</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {readers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No readers registered yet
                    </TableCell>
                  </TableRow>
                ) : readers.map(r => (
                  <TableRow key={r.reader_id} hover>
                    <TableCell><code>{r.reader_key}</code></TableCell>
                    <TableCell>{r.machine_name}</TableCell>
                    <TableCell>{r.location_label}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                        {MCS_BASE}/station?reader={r.reader_key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.active ? 'Active' : 'Inactive'} size="small" color={r.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditReader(r)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* Badge dialog */}
      <Dialog open={badgeDialog} onClose={() => setBadgeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editBadge ? 'Edit Badge' : 'Register New Badge'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                label="Badge ID *"
                value={badgeForm.badge_id}
                onChange={e => setBadgeForm(f => ({ ...f, badge_id: e.target.value }))}
                fullWidth
                disabled={!!editBadge}
                placeholder={capturingBadge ? 'Scan badge now...' : 'Type or scan badge'}
                sx={{ input: { bgcolor: capturingBadge ? '#fff9c4' : undefined } }}
              />
              {!editBadge && (
                <Button
                  variant={capturingBadge ? 'contained' : 'outlined'}
                  color={capturingBadge ? 'warning' : 'primary'}
                  onClick={() => setCapturingBadge(v => !v)}
                  sx={{ whiteSpace: 'nowrap', minWidth: 110 }}
                >
                  {capturingBadge ? 'Scan Now...' : 'Scan Badge'}
                </Button>
              )}
            </Box>
            <TextField
              label="Person Name *"
              value={badgeForm.person_name}
              onChange={e => setBadgeForm(f => ({ ...f, person_name: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select
                value={badgeForm.role}
                label="Role *"
                onChange={e => setBadgeForm(f => ({ ...f, role: e.target.value as 'operator' | 'technician' }))}
              >
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBadgeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveBadge} disabled={!badgeForm.badge_id || !badgeForm.person_name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reader dialog */}
      <Dialog open={readerDialog} onClose={() => setReaderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editReader ? 'Edit Reader' : 'Register New Reader'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Reader Key *"
              value={readerForm.reader_key}
              onChange={e => setReaderForm(f => ({ ...f, reader_key: e.target.value }))}
              fullWidth
              helperText="Unique ID for this reader (used in the station URL)"
              disabled={!!editReader}
            />
            <FormControl fullWidth>
              <InputLabel>Machine *</InputLabel>
              <Select
                value={readerForm.machine_id}
                label="Machine *"
                onChange={e => setReaderForm(f => ({ ...f, machine_id: e.target.value }))}
              >
                <MenuItem value="">— Select Machine —</MenuItem>
                {machines.map(m => (
                  <MenuItem key={m.machine_id} value={m.machine_id.toString()}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Location Label"
              value={readerForm.location_label}
              onChange={e => setReaderForm(f => ({ ...f, location_label: e.target.value }))}
              fullWidth
              placeholder="e.g. Press #3 — Bay 2"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReaderDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveReader} disabled={!readerForm.reader_key || !readerForm.machine_id}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
