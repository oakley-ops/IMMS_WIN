// frontend/src/components/demo/DemoResetButton.tsx
import React, { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, CircularProgress,
} from '@mui/material';
import { RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';

const DemoResetButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  const handleConfirm = async () => {
    setResetting(true);
    try {
      await axiosInstance.post('/api/v1/demo/reset');
      setOpen(false);
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      console.error('Reset failed', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        startIcon={<RotateCcw size={12} />}
        onClick={() => setOpen(true)}
        sx={{
          mr: 1.5,
          height: 28,
          fontSize: '11px',
          fontWeight: 700,
          color: '#fca5a5',
          border: '1px solid rgba(239,68,68,0.3)',
          bgcolor: 'rgba(239,68,68,0.1)',
          textTransform: 'none',
          '&:hover': { bgcolor: 'rgba(239,68,68,0.22)', borderColor: 'rgba(239,68,68,0.55)' },
        }}
      >
        Reset Demo
      </Button>

      <Dialog open={open} onClose={() => !resetting && setOpen(false)}>
        <DialogTitle>Reset demo data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will wipe all demo data and restore the sample scenarios. Any changes made
            during this session will be lost. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={resetting}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            color="error"
            variant="contained"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={14} color="inherit" /> : <RotateCcw size={14} />}
          >
            {resetting ? 'Resetting...' : 'Reset Demo'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DemoResetButton;
