import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const PredictiveMaintenanceReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dies, setDies] = useState<any[]>([]);

  useEffect(() => {
    fetchMaintenanceData();
  }, []);

  const fetchMaintenanceData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/dies`, { headers });
      setDies(response.data);
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDie = (die: any) => {
    const cyclePercentage = die.max_cycles_before_sharpening
      ? (die.total_cycles / die.max_cycles_before_sharpening) * 100
      : 0;
    const sharpeningPercentage = die.max_sharpenings
      ? (die.sharpenings_count / die.max_sharpenings) * 100
      : 0;

    let urgency = 'low';
    let daysUntilMaintenance = null;
    let recommendation = '';

    if (cyclePercentage >= 95 || sharpeningPercentage >= 95) {
      urgency = 'critical';
      daysUntilMaintenance = 0;
      recommendation = 'Immediate action required - Replace or retire die';
    } else if (cyclePercentage >= 85 || sharpeningPercentage >= 85) {
      urgency = 'high';
      daysUntilMaintenance = 3;
      recommendation = 'Schedule sharpening within 3 days';
    } else if (cyclePercentage >= 75 || sharpeningPercentage >= 75) {
      urgency = 'medium';
      daysUntilMaintenance = 7;
      recommendation = 'Schedule sharpening within 1 week';
    } else {
      urgency = 'low';
      const remainingCycles = die.max_cycles_before_sharpening - die.total_cycles;
      daysUntilMaintenance = Math.floor(remainingCycles / 100);
      recommendation = 'No immediate action needed';
    }

    return {
      urgency,
      daysUntilMaintenance,
      recommendation,
      cyclePercentage,
      sharpeningPercentage,
    };
  };

  const getCriticalDies = () => {
    return dies
      .map((die) => ({ ...die, analysis: analyzeDie(die) }))
      .filter((d) => d.analysis.urgency === 'critical' || d.analysis.urgency === 'high')
      .sort((a, b) => {
        const urgencyOrder: any = { critical: 0, high: 1, medium: 2, low: 3 };
        return urgencyOrder[a.analysis.urgency] - urgencyOrder[b.analysis.urgency];
      });
  };

  const getUrgencyCounts = () => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    dies.forEach((die) => {
      const analysis = analyzeDie(die);
      counts[analysis.urgency as keyof typeof counts]++;
    });
    return counts;
  };

  const getUrgencyColor = (urgency: string) => {
    const colors: any = {
      critical: '#F44336',
      high: '#FF9800',
      medium: '#FFC107',
      low: '#4CAF50',
    };
    return colors[urgency] || '#9E9E9E';
  };

  const getUrgencyIcon = (urgency: string) => {
    if (urgency === 'critical') return <Error />;
    if (urgency === 'high' || urgency === 'medium') return <Warning />;
    return <CheckCircle />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  const urgencyCounts = getUrgencyCounts();
  const criticalDies = getCriticalDies();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
        Predictive Maintenance
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          This report uses cycle counts and sharpening history to predict when dies will need
          maintenance. Dies at 75%+ capacity are flagged for proactive scheduling.
        </Typography>
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FFEBEE' }}>
            <Error sx={{ fontSize: 40, color: '#F44336', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Critical
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#F44336' }}>
              {urgencyCounts.critical}
            </Typography>
            <Typography variant="caption">Immediate action</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FFF3E0' }}>
            <Warning sx={{ fontSize: 40, color: '#FF9800', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              High Priority
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
              {urgencyCounts.high}
            </Typography>
            <Typography variant="caption">Within 3 days</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FFFDE7' }}>
            <Warning sx={{ fontSize: 40, color: '#FFC107', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Medium Priority
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#FFC107' }}>
              {urgencyCounts.medium}
            </Typography>
            <Typography variant="caption">Within 1 week</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#E8F5E9' }}>
            <CheckCircle sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Healthy
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
              {urgencyCounts.low}
            </Typography>
            <Typography variant="caption">No issues</Typography>
          </Paper>
        </Grid>
      </Grid>

      {criticalDies.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#F44336' }}>
            ⚠️ Dies Requiring Attention
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Priority</strong></TableCell>
                  <TableCell><strong>Die Number</strong></TableCell>
                  <TableCell><strong>Die Name</strong></TableCell>
                  <TableCell align="center"><strong>Cycle Usage</strong></TableCell>
                  <TableCell align="center"><strong>Sharpening Usage</strong></TableCell>
                  <TableCell><strong>Recommendation</strong></TableCell>
                  <TableCell align="center"><strong>Timeline</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {criticalDies.map((die) => (
                  <TableRow key={die.die_id} hover>
                    <TableCell>
                      <Chip
                        icon={getUrgencyIcon(die.analysis.urgency)}
                        label={die.analysis.urgency.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: getUrgencyColor(die.analysis.urgency),
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#0066A1' }}>
                      {die.die_number}
                    </TableCell>
                    <TableCell>{die.die_name}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ minWidth: 100 }}>
                        <Typography variant="caption">
                          {die.total_cycles || 0} / {die.max_cycles_before_sharpening || 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, die.analysis.cyclePercentage)}
                          sx={{
                            mt: 0.5,
                            '& .MuiLinearProgress-bar': {
                              bgcolor:
                                die.analysis.cyclePercentage >= 90
                                  ? '#F44336'
                                  : die.analysis.cyclePercentage >= 75
                                  ? '#FF9800'
                                  : '#4CAF50',
                            },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {die.analysis.cyclePercentage.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ minWidth: 100 }}>
                        <Typography variant="caption">
                          {die.sharpenings_count || 0} / {die.max_sharpenings || 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, die.analysis.sharpeningPercentage)}
                          sx={{
                            mt: 0.5,
                            '& .MuiLinearProgress-bar': {
                              bgcolor:
                                die.analysis.sharpeningPercentage >= 90
                                  ? '#F44336'
                                  : die.analysis.sharpeningPercentage >= 75
                                  ? '#FF9800'
                                  : '#4CAF50',
                            },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {die.analysis.sharpeningPercentage.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{die.analysis.recommendation}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={
                          die.analysis.daysUntilMaintenance === 0
                            ? 'NOW'
                            : `${die.analysis.daysUntilMaintenance} days`
                        }
                        size="small"
                        sx={{
                          bgcolor:
                            die.analysis.daysUntilMaintenance === 0 ? '#F44336' : '#FF9800',
                          color: 'white',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Maintenance Recommendations
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2, bgcolor: '#FFEBEE', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#F44336', mb: 1 }}>
                Immediate Actions
              </Typography>
              <Typography variant="body2">
                • Review {urgencyCounts.critical} critical dies immediately
                <br />
                • Schedule sharpening for {urgencyCounts.high} high-priority dies within 3 days
                <br />• Consider retiring dies that have reached maximum sharpenings
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2, bgcolor: '#E8F5E9', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#4CAF50', mb: 1 }}>
                Preventive Measures
              </Typography>
              <Typography variant="body2">
                • Monitor {urgencyCounts.medium} medium-priority dies weekly
                <br />
                • Maintain inventory of replacement dies
                <br />• Schedule routine inspections for installed dies
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default PredictiveMaintenanceReport;
