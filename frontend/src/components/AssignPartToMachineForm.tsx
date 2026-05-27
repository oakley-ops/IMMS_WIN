import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <FormControl fullWidth sx={{ mb: 3 }} required>
        <InputLabel id="select-part-label">Select Part</InputLabel>
        <Select
          labelId="select-part-label"
          value={selectedPart}
          label="Select Part"
          onChange={(e) => setSelectedPart(e.target.value)}
        >
          <MenuItem value="">
            <em>Choose a part...</em>
          </MenuItem>
          {parts.map((part) => (
            <MenuItem key={part.part_id} value={String(part.part_id)}>
              {part.name} (Available: {part.quantity})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 3 }} required>
        <InputLabel id="select-machine-label">Select Machine</InputLabel>
        <Select
          labelId="select-machine-label"
          value={selectedMachine}
          label="Select Machine"
          onChange={(e) => setSelectedMachine(e.target.value)}
        >
          <MenuItem value="">
            <em>Choose a machine...</em>
          </MenuItem>
          {machines.map((machine) => (
            <MenuItem key={machine.machine_id} value={String(machine.machine_id)}>
              {machine.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Quantity"
        type="number"
        inputProps={{ min: 1 }}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {loading ? 'Assigning...' : 'Assign Part'}
      </Button>
    </Box>
  );
};

export default AssignPartToMachineForm;
