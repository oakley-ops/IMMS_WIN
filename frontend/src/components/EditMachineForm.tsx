import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchMachines } from '../store/machinesSlice';

interface MachineFormData {
  name: string;
  model_number: string;
  serial_number: string;
}

const EditMachineForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<MachineFormData>({
    name: '',
    model_number: '',
    serial_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const response = await axios.get(`/api/v1/machines/${id}`);
        setFormData(response.data);
      } catch (error: any) {
        console.error('Error fetching machine:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMachine();
    }
  }, [id]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name || !formData.model_number || !formData.serial_number) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await axios.put(`/api/v1/machines/${id}`, formData);
      dispatch(fetchMachines());
      navigate('/machines');
    } catch (error: any) {
      console.error('Error updating machine:', error);
      alert(error.response?.data?.message || 'Failed to update machine.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Grid container justifyContent="center">
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" align="center" sx={{ mb: 4 }}>
                Edit Machine
              </Typography>
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Machine Name"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  sx={{ mb: 3 }}
                />
                <TextField
                  fullWidth
                  label="Model Number"
                  id="model_number"
                  name="model_number"
                  value={formData.model_number}
                  onChange={handleChange}
                  required
                  sx={{ mb: 3 }}
                />
                <TextField
                  fullWidth
                  label="Serial Number"
                  id="serial_number"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleChange}
                  required
                  sx={{ mb: 3 }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button type="submit" variant="contained" color="primary" fullWidth>
                    Update Machine
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    onClick={() => navigate('/machines')}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EditMachineForm;
