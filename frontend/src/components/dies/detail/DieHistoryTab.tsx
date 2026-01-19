import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Divider,
} from '@mui/material';
import {
  Build,
  RemoveCircle,
  Schedule,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface DieHistoryTabProps {
  dieId: number;
}

const DieHistoryTab: React.FC<DieHistoryTabProps> = ({ dieId }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [dieId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/dies/${dieId}/history`, { headers });
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching die history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action === 'INSTALL') return <Build />;
    if (action === 'REMOVE') return <RemoveCircle />;
    return <Schedule />;
  };

  const getActionColor = (action: string) => {
    if (action === 'INSTALL') return '#4CAF50';
    if (action === 'REMOVE') return '#F44336';
    return '#FF9800';
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getReasonLabel = (code: string) => {
    const labels: any = {
      NEW_INSTALL: 'New Installation',
      REPLACEMENT: 'Replacement',
      SCH_MAINT: 'Scheduled Maintenance',
      DULL: 'Die Dull',
      DAMAGED: 'Damaged',
      QUALITY: 'Quality Issues',
      ROTATION: 'Die Rotation',
      UPGRADE: 'Upgrade',
      OTHER: 'Other',
    };
    return labels[code] || code;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">No change history recorded yet.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {history.map((record, index) => {
          const { date, time } = formatDate(record.change_date);
          return (
            <Grid item xs={12} key={record.history_id}>
              <Card
                sx={{
                  borderLeft: `4px solid ${getActionColor(record.action)}`,
                  position: 'relative',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexGrow: 1 }}>
                      <Box
                        sx={{
                          bgcolor: getActionColor(record.action),
                          color: 'white',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getActionIcon(record.action)}
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {record.action === 'INSTALL' ? 'Installed' : 'Removed'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {date} at {time}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={getReasonLabel(record.change_reason_code)}
                        size="small"
                        sx={{ mb: 0.5 }}
                      />
                      {record.machine_name && (
                        <Chip label={record.machine_name} size="small" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Grid container spacing={2}>
                    {record.technician_name && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Technician or Operator
                        </Typography>
                        <Typography variant="body2">{record.technician_name}</Typography>
                      </Grid>
                    )}
                    {record.action === 'INSTALL' && record.expected_cycles && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Expected Cycles
                        </Typography>
                        <Typography variant="body2">{record.expected_cycles}</Typography>
                      </Grid>
                    )}
                    {record.action === 'REMOVE' && (
                      <>
                        {record.actual_cycles && (
                          <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                              Actual Cycles
                            </Typography>
                            <Typography variant="body2">{record.actual_cycles}</Typography>
                          </Grid>
                        )}
                        {record.cycles_at_removal && (
                          <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                              Total Cycles at Removal
                            </Typography>
                            <Typography variant="body2">{record.cycles_at_removal}</Typography>
                          </Grid>
                        )}
                        {record.die_condition && (
                          <Grid item xs={12} sm={4}>
                            <Typography variant="caption" color="text.secondary">
                              Condition
                            </Typography>
                            <Typography variant="body2">{record.die_condition}</Typography>
                          </Grid>
                        )}
                      </>
                    )}
                  </Grid>
                  {record.change_reason_notes && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        "{record.change_reason_notes}"
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default DieHistoryTab;
