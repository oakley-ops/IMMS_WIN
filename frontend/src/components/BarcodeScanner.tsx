// src/components/BarcodeScanner.tsx
import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Box,
  Button,
  Alert,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  Stop as StopIcon,
} from '@mui/icons-material';

interface BarcodeScannerProps {
  onScan?: (result: string) => void;
  onError?: (error: string) => void;
  onBarcodeScanned?: (scannedBarcode: string) => void; // For backward compatibility
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onError,
  onBarcodeScanned // For backward compatibility
}) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup scanner on component unmount
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanner]);

  const startScanning = () => {
    try {
      const newScanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 300, height: 100 }, // Optimized for barcode shape
          aspectRatio: 1.777778, // 16:9 aspect ratio for better camera view
        },
        false
      );

      newScanner.render(
        (decodedText) => {
          // Success callback
          console.log('Scanned barcode:', decodedText);
          if (onScan) {
            onScan(decodedText);
          }
          if (onBarcodeScanned) {
            onBarcodeScanned(decodedText);
          }
          newScanner.clear();
          setScanner(null);
          setScanning(false);
        },
        (errorMessage) => {
          // Error callback
          console.error('Scan error:', errorMessage);
          if (onError) {
            onError(errorMessage);
          }
          // Only set UI error for permission or initialization issues
          if (errorMessage.includes('permission') || errorMessage.includes('initialization')) {
            setError(errorMessage);
          }
        }
      );

      setScanner(newScanner);
      setScanning(true);
      setError(null);
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setError('Failed to initialize camera. Please make sure you have granted camera permissions.');
    }
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScanning(false);
  };

  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Barcode Scanner
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box id="reader" sx={{ mb: 2 }} />

        {!scanning ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<QrCodeScannerIcon />}
            onClick={startScanning}
            sx={{ mr: 1 }}
          >
            Start Scanner
          </Button>
        ) : (
          <Button
            variant="outlined"
            startIcon={<StopIcon />}
            onClick={stopScanning}
          >
            Stop Scanner
          </Button>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Supports most common barcode formats including EAN, UPC, Code 128, and Code 39
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BarcodeScanner;
