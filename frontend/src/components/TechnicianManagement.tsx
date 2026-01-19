import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Chip,
  Switch,
  FormControlLabel,
  Container,
  Grid,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  RestartAlt as RestartAltIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axios';

interface Technician {
  technician_id: number;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface TechnicianFormData {
  name: string;
  active: boolean;
}

const TechnicianManagement: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [formData, setFormData] = useState<TechnicianFormData>({
    name: '',
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axiosInstance.get('/api/v1/technicians/all');
      setTechnicians(response.data || []);
    } catch (error: any) {
      console.error('Error fetching technicians:', error);
      setError('Failed to load technicians. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (technician?: Technician) => {
    if (technician) {
      // Edit mode
      setSelectedTechnician(technician);
      setFormData({
        name: technician.name,
        active: technician.active
      });
    } else {
      // Add mode
      setSelectedTechnician(null);
      setFormData({
        name: '',
        active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTechnician(null);
    setFormData({ name: '', active: true });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Technician name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (selectedTechnician) {
        // Update existing technician
        await axiosInstance.put(`/api/v1/technicians/${selectedTechnician.technician_id}`, formData);
        setSuccess('Technician updated successfully');
      } else {
        // Create new technician
        await axiosInstance.post('/api/v1/technicians', formData);
        setSuccess('Technician added successfully');
      }

      handleCloseDialog();
      fetchTechnicians();
    } catch (error: any) {
      console.error('Error submitting technician:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save technician';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (technician: Technician) => {
    if (window.confirm(`Are you sure you want to deactivate ${technician.name}?`)) {
      try {
        await axiosInstance.delete(`/api/v1/technicians/${technician.technician_id}`);
        setSuccess('Technician deactivated successfully');
        fetchTechnicians();
      } catch (error: any) {
        console.error('Error deactivating technician:', error);
        const errorMessage = error.response?.data?.error || 'Failed to deactivate technician';
        setError(errorMessage);
      }
    }
  };

  const handleReactivate = async (technician: Technician) => {
    try {
      await axiosInstance.post(`/api/v1/technicians/${technician.technician_id}/reactivate`);
      setSuccess('Technician reactivated successfully');
      fetchTechnicians();
    } catch (error: any) {
      console.error('Error reactivating technician:', error);
      const errorMessage = error.response?.data?.error || 'Failed to reactivate technician';
      setError(errorMessage);
    }
  };

  const activeTechnicians = technicians.filter(t => t.active);
  const inactiveTechnicians = technicians.filter(t => t.active === false);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center">
            <BuildIcon sx={{ mr: 2, color: '#FF6200', fontSize: 32 }} />
            <Typography variant="h4" sx={{ color: '#0066A1', fontWeight: 'bold' }}>
              Technician Management
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            variant="contained"
            sx={{ 
              backgroundColor: '#FF6200', 
              '&:hover': { backgroundColor: '#e55a00' }
            }}
          >
            Add New Technician
          </Button>
        </Box>
        
        <Typography variant="body1" color="textSecondary">
          Manage technicians for preventive maintenance assignments
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PersonIcon sx={{ color: '#4caf50', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                    {activeTechnicians.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Technicians
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CancelIcon sx={{ color: '#f44336', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                    {inactiveTechnicians.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Inactive Technicians
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PersonAddIcon sx={{ color: '#2196f3', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                    {technicians.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Technicians
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <BuildIcon sx={{ color: '#ff9800', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                    {activeTechnicians.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Available for PM
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Active Technicians Table */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 3, backgroundColor: '#0066A1', color: 'white' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircleIcon sx={{ mr: 1 }} />
            Active Technicians ({activeTechnicians.length})
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
                <TableCell><strong>Last Updated</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeTechnicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No active technicians found. Add your first technician!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                activeTechnicians.map((technician) => (
                  <TableRow key={technician.technician_id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <PersonIcon sx={{ mr: 1, color: '#0066A1' }} />
                        {technician.name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Active" 
                        color="success" 
                        size="small"
                        icon={<CheckCircleIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(technician.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(technician.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Technician">
                        <IconButton 
                          onClick={() => handleOpenDialog(technician)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Deactivate Technician">
                        <IconButton 
                          onClick={() => handleDeactivate(technician)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Inactive Technicians Table
      {inactiveTechnicians.length > 0 && (
        <Paper>
          <Box sx={{ p: 3, backgroundColor: '#f44336', color: 'white' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <CancelIcon sx={{ mr: 1 }} />
              Inactive Technicians ({inactiveTechnicians.length})
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell><strong>Last Updated</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inactiveTechnicians.map((technician) => (
                  <TableRow key={technician.technician_id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <PersonIcon sx={{ mr: 1, color: '#ccc' }} />
                        <span style={{ opacity: 0.6 }}>{technician.name}</span>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Inactive" 
                        color="error" 
                        size="small"
                        icon={<CancelIcon />}
                      />
                    </TableCell>
                    <TableCell style={{ opacity: 0.6 }}>
                      {new Date(technician.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell style={{ opacity: 0.6 }}>
                      {new Date(technician.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Reactivate Technician">
                        <IconButton 
                          onClick={() => handleReactivate(technician)}
                          color="success"
                          size="small"
                        >
                          <RestartAltIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )} */}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedTechnician ? 'Edit Technician' : 'Add New Technician'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              label="Technician Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!formData.name.trim() && formData.name !== ''}
              helperText={!formData.name.trim() && formData.name !== '' ? 'Name is required' : ''}
              sx={{ mb: 3 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  color="primary"
                />
              }
              label="Active"
            />
            
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Active technicians will appear in the PM assignment dropdown
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={isSubmitting || !formData.name.trim()}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Saving...' : (selectedTechnician ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TechnicianManagement; 