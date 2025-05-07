// src/components/BarcodeScanner.tsx
import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button, Alert, Card } from 'react-bootstrap';

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
    <Card className="mb-3">
      <Card.Body>
        <Card.Title>Barcode Scanner</Card.Title>
        
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        <div id="reader" className="mb-3"></div>

        {!scanning ? (
          <Button 
            variant="primary" 
            onClick={startScanning}
            className="me-2"
          >
            Start Scanner
          </Button>
        ) : (
          <Button 
            variant="secondary" 
            onClick={stopScanning}
          >
            Stop Scanner
          </Button>
        )}

        <div className="mt-3">
          <small className="text-muted">
            Supports most common barcode formats including EAN, UPC, Code 128, and Code 39
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default BarcodeScanner;