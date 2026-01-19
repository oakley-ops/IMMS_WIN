import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  CameraAlt,
  Close,
  CheckCircle,
} from '@mui/icons-material';

interface DieBarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
}

const DieBarcodeScanner: React.FC<DieBarcodeScannerProps> = ({
  open,
  onClose,
  onScan,
  title = 'Scan Die Barcode',
  description = 'Position the barcode within the frame to scan',
}) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open && !scanner) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        startScanning();
      }, 300);
    } else if (!open && scanner) {
      stopScanning();
    }

    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
  }, [open]);

  const startScanning = () => {
    try {
      setError(null);
      setScanSuccess(null);
      
      const newScanner = new Html5QrcodeScanner(
        "die-barcode-reader",
        {
          fps: 10,
          qrbox: { width: 300, height: 200 },
          aspectRatio: 1.777778,
        },
        false // verbose
      );

      newScanner.render(
        (decodedText) => {
          // Success callback
          console.log('Scanned barcode:', decodedText);
          setScanSuccess(decodedText);
          setScanning(false);
          
          // Stop scanner
          try {
            newScanner.clear();
            setScanner(null);
          } catch (err) {
            console.error('Error clearing scanner:', err);
          }
          
          // Call onScan callback
          onScan(decodedText);
          
          // Auto-close after short delay
          setTimeout(() => {
            onClose();
          }, 1000);
        },
        (errorMessage) => {
          // Error callback - only log, don't show UI errors for normal scanning
          // Only show errors for permission or initialization issues
          if (
            errorMessage.includes('permission') ||
            errorMessage.includes('Permission') ||
            errorMessage.includes('initialization') ||
            errorMessage.includes('No MultiFormat Readers')
          ) {
            setError(errorMessage);
            setScanning(false);
          }
          // Ignore other scanning errors (normal when no code is in view)
        }
      );

      setScanner(newScanner);
      setScanning(true);
    } catch (err: any) {
      console.error('Scanner initialization error:', err);
      setError(
        err.message ||
        'Failed to initialize camera. Please make sure you have granted camera permissions.'
      );
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanner) {
      try {
        scanner.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setScanner(null);
    }
    setScanning(false);
    setError(null);
    setScanSuccess(null);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '500px',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt color="primary" />
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
              <br />
              <Button
                size="small"
                onClick={startScanning}
                sx={{ mt: 1 }}
                startIcon={<CameraAlt />}
              >
                Try Again
              </Button>
            </Alert>
          )}

          {scanSuccess && (
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                Scanned: {scanSuccess}
              </Typography>
            </Alert>
          )}

          {scanning && !error && (
            <Box
              id="die-barcode-reader"
              sx={{
                width: '100%',
                minHeight: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                mb: 2,
              }}
            />
          )}

          {!scanning && !error && !scanSuccess && (
            <Box
              sx={{
                width: '100%',
                minHeight: '300px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                mb: 2,
              }}
            >
              <CameraAlt sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Click "Start Scanner" to begin
              </Typography>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Supports: Code 128, Code 39, EAN, UPC, and QR codes
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {!scanning && !scanSuccess && (
          <Button
            variant="contained"
            onClick={startScanning}
            startIcon={scanning ? <CircularProgress size={16} /> : <CameraAlt />}
            disabled={scanning}
            sx={{
              bgcolor: '#FF6600',
              '&:hover': { bgcolor: '#E55A00' },
            }}
          >
            {scanning ? 'Scanning...' : 'Start Scanner'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DieBarcodeScanner;

