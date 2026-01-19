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
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
} from '@mui/material';
import {
  Eject as EjectIcon,
} from '@mui/icons-material';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
}

interface RemovalReasonDialogProps {
  open: boolean;
  die: Die | null;
  onClose: () => void;
  onConfirm: (dieId: number, reasonCode: string, notes: string) => Promise<void>;
}

const REMOVAL_REASONS = [
  { code: 'CHANGE_TO_NOTCH', label: 'Change to Notch die' },
  { code: 'ROUGH_EDGES', label: 'Rough edges on card' },
  { code: 'MAINTENANCE', label: 'Scheduled maintenance' },
  { code: 'SHARPENING_NEEDED', label: 'Sharpening needed' },
  { code: 'OTHER', label: 'Other' },
];

const RemovalReasonDialog: React.FC<RemovalReasonDialogProps> = ({
  open,
  die,
  onClose,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!die || !selectedReason) return;

    try {
      setLoading(true);
      const reasonLabel = REMOVAL_REASONS.find(r => r.code === selectedReason)?.label || selectedReason;
      const fullNotes = notes ? `${reasonLabel}: ${notes}` : reasonLabel;
      await onConfirm(die.die_id, selectedReason, fullNotes);
      setSelectedReason('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error removing die:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedReason('');
      setNotes('');
      onClose();
    }
  };

  if (!die) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#F44336', color: 'white', display: 'flex', alignItems: 'center' }}>
        <EjectIcon sx={{ mr: 1 }} />
        Remove Die from Machine
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ mb: 3, p: 2, bgcolor: '#ffebee', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#c62828' }}>
            Die #{die.die_number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Type: {die.die_type}
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold' }}>
          Why is this die being removed?
        </Typography>

        <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
          <RadioGroup
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
          >
            {REMOVAL_REASONS.map((reason) => (
              <FormControlLabel
                key={reason.code}
                value={reason.code}
                control={<Radio sx={{ color: '#F44336', '&.Mui-checked': { color: '#F44336' } }} />}
                label={reason.label}
                disabled={loading}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: selectedReason === reason.code ? '#ffebee' : 'transparent',
                  '&:hover': { bgcolor: '#fff5f5' },
                }}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <TextField
          label="Additional Notes (optional)"
          multiline
          rows={2}
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional details..."
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
          disabled={loading || !selectedReason}
          startIcon={loading ? <CircularProgress size={20} /> : <EjectIcon />}
          sx={{
            bgcolor: '#F44336',
            '&:hover': { bgcolor: '#D32F2F' },
          }}
        >
          {loading ? 'Removing...' : 'Remove Die'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemovalReasonDialog;
