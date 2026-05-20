'use client';
import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Grid, Button, TextField, List, ListItem, ListItemText,
  IconButton, Divider, Box, InputAdornment,
} from '@mui/material';
import { Search, Delete } from '@mui/icons-material';
import svc, { PartResult } from '../../services/maintenanceCallService';
import { MCS_ORANGE } from '../../theme';

const REASON_OPTIONS = [
  { value: 'mechanical',     label: 'Mechanical' },
  { value: 'electrical',     label: 'Electrical' },
  { value: 'tooling',        label: 'Tooling / Die' },
  { value: 'material',       label: 'Material Feed' },
  { value: 'operator_error', label: 'Operator Error' },
  { value: 'other',          label: 'Other' },
];

interface PartUsed {
  part_id: number;
  part_name: string;
  part_number: string;
  quantity: number;
}

interface Props {
  open: boolean;
  machineName?: string;
  onClose: () => void;
  /**
   * Resolves once the resolve API call (and parts log, if any) completes.
   * Receives the resolution details plus any parts used.
   */
  onResolve: (data: { reason: string; notes: string; parts: PartUsed[] }) => Promise<void>;
}

const ResolveDialog: React.FC<Props> = ({ open, machineName, onClose, onResolve }) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [partResults, setPartResults] = useState<PartResult[]>([]);
  const [parts, setParts] = useState<PartUsed[]>([]);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const reset = () => {
    setReason('');
    setNotes('');
    setPartSearch('');
    setPartResults([]);
    setParts([]);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handlePartSearch = (q: string) => {
    setPartSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setPartResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { setPartResults(await svc.searchParts(q)); } catch { /* non-fatal */ }
    }, 300);
  };

  const addPart = (p: PartResult) => {
    setParts((prev) => {
      const existing = prev.find((x) => x.part_id === p.part_id);
      if (existing) {
        return prev.map((x) => x.part_id === p.part_id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [
        ...prev,
        {
          part_id: p.part_id,
          part_name: p.name,
          part_number: p.fiserv_part_number || p.manufacturer_part_number || '',
          quantity: 1,
        },
      ];
    });
    setPartSearch('');
    setPartResults([]);
  };

  const updateQty = (partId: number, qty: number) => {
    setParts((prev) =>
      prev.map((x) => x.part_id === partId ? { ...x, quantity: Math.max(1, qty || 1) } : x)
    );
  };

  const removePart = (partId: number) => {
    setParts((prev) => prev.filter((x) => x.part_id !== partId));
  };

  const handleSubmit = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await onResolve({ reason, notes, parts });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Resolve Call{machineName ? ` — ${machineName}` : ''}
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" color="text.secondary" mb={1} mt={1}>Failure Reason</Typography>
        <Grid container spacing={1} mb={2}>
          {REASON_OPTIONS.map((o) => (
            <Grid item xs={6} key={o.value}>
              <Button
                fullWidth
                variant={reason === o.value ? 'contained' : 'outlined'}
                onClick={() => setReason(o.value)}
                sx={{ bgcolor: reason === o.value ? MCS_ORANGE : undefined, cursor: 'pointer' }}
              >
                {o.label}
              </Button>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" mb={1}>Parts Used (optional)</Typography>
        <TextField
          fullWidth size="small"
          placeholder="Search by part name or number..."
          value={partSearch}
          onChange={(e) => handlePartSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ mb: 1 }}
        />
        {partResults.length > 0 && (
          <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1, maxHeight: 180, overflow: 'auto' }}>
            {partResults.map((p) => (
              <ListItem
                key={p.part_id}
                button
                onClick={() => addPart(p)}
                sx={{ '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemText
                  primary={p.name}
                  secondary={`${p.fiserv_part_number || p.manufacturer_part_number || '—'}  •  Qty on hand: ${p.quantity}`}
                />
              </ListItem>
            ))}
          </List>
        )}
        {parts.length > 0 && (
          <Box mb={2}>
            {parts.map((p) => (
              <Box key={p.part_id} display="flex" alignItems="center" gap={1} mb={0.5}>
                <Typography variant="body2" flex={1}>
                  {p.part_name} <span style={{ color: '#999' }}>({p.part_number})</span>
                </Typography>
                <TextField
                  type="number" size="small" value={p.quantity}
                  onChange={(e) => updateQty(p.part_id, parseInt(e.target.value, 10))}
                  sx={{ width: 70 }} inputProps={{ min: 1 }}
                />
                <IconButton size="small" onClick={() => removePart(p.part_id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <TextField
          label="What was done to fix it? *"
          multiline rows={3} fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe the repair..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ cursor: 'pointer' }}>Cancel</Button>
        <Button
          variant="contained" color="success"
          onClick={handleSubmit}
          disabled={!notes.trim() || saving}
          sx={{ minWidth: 160, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Mark Resolved'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResolveDialog;
