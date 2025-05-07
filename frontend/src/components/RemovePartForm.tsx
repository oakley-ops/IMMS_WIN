// src/components/RemovePartForm.tsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchParts } from '../store/partsSlice';
import axiosInstance from '../utils/axios';
import { Form, Alert, Button, Spinner } from 'react-bootstrap'; // Import Form, Alert, Button, and Spinner components

const RemovePartForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [barcode, setBarcode] = useState('');
  const [quantityToRemove, setQuantityToRemove] = useState(1); // Default to removing 1 item
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!barcode) {
      setError('Please scan a barcode first.');
      setLoading(false);
      return;
    }

    try {
      await axiosInstance.post('/api/v1/parts/remove', { 
        barcode, 
        quantity: quantityToRemove 
      });
      dispatch(fetchParts());
      setBarcode('');
      setQuantityToRemove(1); // Reset quantity
      alert('Part removed from inventory.');
    } catch (err) {
      console.error('Error removing part:', err);
      setError('Failed to remove part. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form.Group className="mb-3">
        <Form.Label>Barcode</Form.Label>
        <Form.Control
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or enter barcode"
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Quantity to Remove</Form.Label>
        <Form.Control
          type="number"
          min="1"
          value={quantityToRemove}
          onChange={(e) => setQuantityToRemove(parseInt(e.target.value))}
          required
        />
      </Form.Group>

      <Button variant="primary" type="submit" disabled={loading}>
        {loading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            Removing...
          </>
        ) : (
          'Remove Part'
        )}
      </Button>
    </Form>
  );
};

export default RemovePartForm;