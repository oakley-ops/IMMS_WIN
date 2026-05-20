'use client';
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Grid, Button,
} from '@mui/material';
import { STATUS_SUSPENDED } from '../../theme';

const SUSPEND_REASONS = [
  'Waiting for parts',
  'Need specialist',
  'Awaiting approval',
  'Shift end — returning next shift',
  'Other',
];

interface Props {
  open: boolean;
  machineName?: string;
  onClose: () => void;
  /** Resolves once the suspend API call is complete. */
  onSuspend: (reason: string) => Promise<void>;
}

const SuspendDialog: React.FC<Props> = ({ open, machineName, onClose, onSuspend }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setReason('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      await onSuspend(reason);
      setReason('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Suspend Call{machineName ? ` — ${machineName}` : ''}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2} mt={1}>
          Why can't this be resolved right now?
        </Typography>
        <Grid container spacing={1}>
          {SUSPEND_REASONS.map((r) => (
            <Grid item xs={12} key={r}>
              <Button
                fullWidth
                variant={reason === r ? 'contained' : 'outlined'}
                onClick={() => setReason(r)}
                sx={{
                  justifyContent: 'flex-start',
                  bgcolor: reason === r ? STATUS_SUSPENDED : undefined,
                  cursor: 'pointer',
                }}
              >
                {r}
              </Button>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ cursor: 'pointer' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!reason || saving}
          sx={{ minWidth: 160, bgcolor: STATUS_SUSPENDED, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Suspend Call'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SuspendDialog;
