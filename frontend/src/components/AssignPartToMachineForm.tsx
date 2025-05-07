import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axios';
import { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types/api';

interface Part {
  part_id: number;
  name: string;
  quantity: number;
}

interface Machine {
  machine_id: number;
  name: string;
}

const AssignPartToMachineForm: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [partsRes, machinesRes] = await Promise.all([
          axiosInstance.get<Part[]>('/api/v1/parts'),
          axiosInstance.get<Machine[]>('/api/v1/machines')
        ]);
        setParts(partsRes.data);
        setMachines(machinesRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        const error = err as AxiosError<ApiErrorResponse>;
        setError(error.response?.data?.error || error.response?.data?.message || 'Failed to load parts and machines');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart || !selectedMachine || !quantity) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await axiosInstance.post('/api/v1/assign-part', {
        partId: parseInt(selectedPart),
        machineId: parseInt(selectedMachine),
        quantity: parseInt(quantity)
      });

      setSuccess('Part assigned successfully');
      setSelectedPart('');
      setSelectedMachine('');
      setQuantity('1');

      // Refresh the parts list
      const partsRes = await axiosInstance.get<Part[]>('/api/v1/parts');
      setParts(partsRes.data);
    } catch (err) {
      console.error('Error assigning part:', err);
      const error = err as AxiosError<ApiErrorResponse>;
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to assign part');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !parts.length) {
    return (
      <div className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Select Part</Form.Label>
        <Form.Select
          value={selectedPart}
          onChange={(e) => setSelectedPart(e.target.value)}
          required
        >
          <option value="">Choose a part...</option>
          {parts.map((part) => (
            <option key={part.part_id} value={part.part_id}>
              {part.name} (Available: {part.quantity})
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Select Machine</Form.Label>
        <Form.Select
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          required
        >
          <option value="">Choose a machine...</option>
          {machines.map((machine) => (
            <option key={machine.machine_id} value={machine.machine_id}>
              {machine.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Quantity</Form.Label>
        <Form.Control
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </Form.Group>

      <Button type="submit" disabled={loading}>
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
            Assigning...
          </>
        ) : (
          'Assign Part'
        )}
      </Button>
    </Form>
  );
};

export default AssignPartToMachineForm;
