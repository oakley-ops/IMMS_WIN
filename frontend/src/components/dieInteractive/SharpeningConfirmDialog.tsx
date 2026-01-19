import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  Build as BuildIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
}

interface SharpeningConfirmDialogProps {
  open: boolean;
  die: Die | null;
  onClose: () => void;
  onConfirm: (dieId: number, notes: string) => Promise<void>;
}

const SharpeningConfirmDialog: React.FC<SharpeningConfirmDialogProps> = ({
  open,
  die,
  onClose,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!die) return;

    try {
      setLoading(true);
      await onConfirm(die.die_id, notes);
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error sending to sharpening:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNotes('');
      onClose();
    }
  };

  if (!die) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#FF9800', color: 'white', display: 'flex', alignItems: 'center' }}>
        <ShippingIcon sx={{ mr: 1 }} />
        Send Die to Sharpening
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ mb: 3, p: 2, bgcolor: '#fff8e1', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#E65100' }}>
            Die #{die.die_number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Type: {die.die_type}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Current Status: {die.status}
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 2 }}>
          This die will be sent to <strong>Mathias</strong> for sharpening.
        </Typography>

        <TextField
          label="Notes (optional)"
          multiline
          rows={3}
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any special instructions or notes..."
          disabled={loading}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <BuildIcon />}
          sx={{
            bgcolor: '#FF9800',
            '&:hover': { bgcolor: '#F57C00' },
          }}
        >
          {loading ? 'Sending...' : 'Send to Mathias'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharpeningConfirmDialog;
