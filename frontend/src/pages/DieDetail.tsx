import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Build,
  RemoveCircle,
  Schedule,
  Delete,
} from '@mui/icons-material';
import axios from 'axios';
import DieOverviewTab from '../components/dies/detail/DieOverviewTab';
import DieHistoryTab from '../components/dies/detail/DieHistoryTab';
import DieSharpeningHistoryTab from '../components/dies/detail/DieSharpeningHistoryTab';
import DieDocumentsTab from '../components/dies/detail/DieDocumentsTab';
import AddEditDieDialog from '../components/dies/AddEditDieDialog';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const DieDetail: React.FC = () => {
  const { dieId } = useParams<{ dieId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [die, setDie] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (dieId) {
      fetchDieDetails();
    }
  }, [dieId, refreshTrigger]);

  const fetchDieDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/dies/${dieId}`, { headers });
      setDie(response.data);
    } catch (err: any) {
      console.error('Error fetching die details:', err);
      setError(err.response?.data?.error || 'Failed to load die details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      SHARP: '#4CAF50',
      USED: '#F44336',
      OUT_FOR_SHARPENING: '#FF9800',
      IN_MACHINE: '#2196F3',
    };
    return colors[status] || '#9E9E9E';
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/dies/${dieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/die-tracker');
    } catch (err: any) {
      console.error('Error deleting die:', err);
      setError(err.response?.data?.error || 'Failed to delete die');
      setDeleteDialogOpen(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !die) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/die-tracker')}>
          Back to Die Tracker
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Die not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/die-tracker')}
          sx={{ textDecoration: 'none', color: '#0066A1', cursor: 'pointer' }}
        >
          Die Tracker
        </Link>
        <Typography color="text.primary">{die.die_number}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0066A1', mb: 2 }}>
                Die {die.die_number}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={die.status.replace(/_/g, ' ')}
                  sx={{
                    bgcolor: getStatusColor(die.status),
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                />
                <Chip label={die.die_type} variant="outlined" />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => setEditDialogOpen(true)}
              >
                Edit
              </Button>
              {die.status !== 'IN_MACHINE' && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleDeleteClick}
                >
                  Delete
                </Button>
              )}
              {die.status === 'SHARP' && (
                <Button
                  variant="contained"
                  startIcon={<Build />}
                  sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#45A049' } }}
                >
                  Install
                </Button>
              )}
              {die.status === 'IN_MACHINE' && (
                <Button
                  variant="contained"
                  startIcon={<RemoveCircle />}
                  sx={{ bgcolor: '#F44336', '&:hover': { bgcolor: '#D32F2F' } }}
                >
                  Remove
                </Button>
              )}
              {die.status === 'USED' && (
                <Button
                  variant="contained"
                  startIcon={<Schedule />}
                  sx={{ bgcolor: '#FF6600', '&:hover': { bgcolor: '#E55A00' } }}
                >
                  Send for Sharpening
                </Button>
              )}
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Current Location
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {die.machine_name || die.current_location || 'Storage'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Change History" />
            <Tab label="Sharpening History" />
            <Tab label="Documents" />
          </Tabs>
        </Box>
        <CardContent>
          {activeTab === 0 && <DieOverviewTab die={die} onRefresh={handleRefresh} />}
          {activeTab === 1 && <DieHistoryTab dieId={die.die_id} />}
          {activeTab === 2 && <DieSharpeningHistoryTab dieId={die.die_id} />}
          {activeTab === 3 && <DieDocumentsTab dieId={die.die_id} onRefresh={handleRefresh} />}
        </CardContent>
      </Card>

      <AddEditDieDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={() => {
          setEditDialogOpen(false);
          handleRefresh();
        }}
        die={die}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Die</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{die?.die_number}</strong>?
            <br /><br />
            This will delete:
            <ul>
              <li>Die record and all specifications</li>
              <li>All change history records</li>
              <li>All sharpening records</li>
              <li>All associated documents</li>
            </ul>
            <strong>This action cannot be undone.</strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <Delete />}
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DieDetail;
