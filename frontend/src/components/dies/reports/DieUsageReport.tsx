import React, { useState, useEffect } from 'react';
import { PRIMARY_ORANGE } from '../../../theme';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

const DieUsageReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dies, setDies] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchUsageData();
  }, [timeRange]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/dies`, { headers });
      setDies(response.data);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalCycles = () => {
    return dies.reduce((sum, die) => sum + (die.total_cycles || 0), 0);
  };

  const getAverageCycles = () => {
    if (dies.length === 0) return 0;
    return getTotalCycles() / dies.length;
  };

  const getMostUsedDies = () => {
    return [...dies].sort((a, b) => (b.total_cycles || 0) - (a.total_cycles || 0)).slice(0, 10);
  };

  const getUtilizationRate = () => {
    const installed = dies.filter((d) => d.status === 'INSTALLED').length;
    return dies.length > 0 ? ((installed / dies.length) * 100).toFixed(1) : '0.0';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Die Usage Analysis
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Time Range</InputLabel>
          <Select value={timeRange} label="Time Range" onChange={(e) => setTimeRange(e.target.value)}>
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="30">Last 30 Days</MenuItem>
            <MenuItem value="90">Last 90 Days</MenuItem>
            <MenuItem value="365">Last Year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#E3F2FD' }}>
            <Typography variant="caption" color="text.secondary">
              Total Dies
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#FF6B35' }}>
              {dies.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#E8F5E9' }}>
            <Typography variant="caption" color="text.secondary">
              Total Cycles
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
              {getTotalCycles().toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FFF3E0' }}>
            <Typography variant="caption" color="text.secondary">
              Avg Cycles/Die
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
              {getAverageCycles().toFixed(0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#F3E5F5' }}>
            <Typography variant="caption" color="text.secondary">
              Utilization Rate
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#9C27B0' }}>
              {getUtilizationRate()}%
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Top 10 Most Used Dies
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell><strong>Rank</strong></TableCell>
                <TableCell><strong>Die Number</strong></TableCell>
                <TableCell><strong>Die Name</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell align="center"><strong>Total Cycles</strong></TableCell>
                <TableCell align="center"><strong>Sharpenings</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getMostUsedDies().map((die, index) => (
                <TableRow key={die.die_id} hover>
                  <TableCell>
                    <Chip
                      label={`#${index + 1}`}
                      size="small"
                      sx={{
                        bgcolor: index < 3 ? '#FFD700' : '#E0E0E0',
                        fontWeight: 'bold',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#FF6B35' }}>
                    {die.die_number}
                  </TableCell>
                  <TableCell>{die.die_name}</TableCell>
                  <TableCell>{die.die_type}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {die.total_cycles || 0}
                  </TableCell>
                  <TableCell align="center">{die.sharpenings_count || 0}</TableCell>
                  <TableCell>
                    <Chip label={die.status.replace(/_/g, ' ')} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Die Status Distribution
            </Typography>
            <Box>
              {['AVAILABLE', 'INSTALLED', 'NEEDS_SHARPENING', 'AT_SHARPENING_VENDOR'].map((status) => {
                const count = dies.filter((d) => d.status === status).length;
                const percentage = dies.length > 0 ? ((count / dies.length) * 100).toFixed(1) : '0.0';
                return (
                  <Box key={status} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{status.replace(/_/g, ' ')}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {count} ({percentage}%)
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 8,
                        bgcolor: '#e0e0e0',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${percentage}%`,
                          height: '100%',
                          bgcolor: '#2196F3',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Die Type Distribution
            </Typography>
            <Box>
              {Array.from(new Set(dies.map((d) => d.die_type))).map((type) => {
                const count = dies.filter((d) => d.die_type === type).length;
                const percentage = dies.length > 0 ? ((count / dies.length) * 100).toFixed(1) : '0.0';
                return (
                  <Box key={type} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{type}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {count} ({percentage}%)
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 8,
                        bgcolor: '#e0e0e0',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${percentage}%`,
                          height: '100%',
                          bgcolor: PRIMARY_ORANGE,
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DieUsageReport;
