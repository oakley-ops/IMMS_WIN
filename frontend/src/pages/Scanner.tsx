import React, { useState } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import BarcodeScanner from '../components/BarcodeScanner';
import axios from 'axios';
import { API_URL } from '../config';
const Scanner: React.FC = () => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleScan = async (result: string) => {
    try {
      setScannedCode(result);
      setError(null);
      setSuccess(null);

      // You can implement your logic here to handle the scanned code
      // For example, looking up a part by its barcode:
      const response = await axios.get(`${API_URL}/api/v1/parts/barcode/${result}`);      
      if (response.data) {
        setSuccess(`Found part: ${response.data.name}`);
      } else {
        setError('No part found with this barcode');
      }
    } catch (err) {
      console.error('Error processing barcode:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to process barcode');
      } else {
        setError('Failed to process barcode');
      }
    }
  };

  const handleError = (error: string) => {
    setError(error);
    setSuccess(null);
  };

  return (
    <Container>
      <Row className="my-4">
        <Col>
          <h1>Barcode Scanner</h1>
          <p className="text-muted">
            Use this scanner to quickly look up parts by their barcode.
          </p>
        </Col>
      </Row>

      <Row>
        <Col md={8} lg={6}>
          <BarcodeScanner 
            onScan={handleScan}
            onError={handleError}
          />

          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mt-3">
              {success}
            </Alert>
          )}

          {scannedCode && (
            <Alert variant="info" className="mt-3">
              Last scanned code: {scannedCode}
            </Alert>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Scanner;
