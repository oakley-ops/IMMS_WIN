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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

const CostAnalysisReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dies, setDies] = useState<any[]>([]);
  const [sharpeningRecords, setSharpeningRecords] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchCostData();
  }, [timeRange]);

  const fetchCostData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [diesResponse, sharpeningResponse] = await Promise.all([
        axios.get(`${API_URL}/dies`, { headers }),
        axios.get(`${API_URL}/die-sharpening`, { headers }),
      ]);

      setDies(diesResponse.data);
      setSharpeningRecords(sharpeningResponse.data);
    } catch (error) {
      console.error('Error fetching cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalPurchaseCost = () => {
    return dies.reduce((sum, die) => {
      const cost = typeof die.purchase_cost === 'string' ? parseFloat(die.purchase_cost) : die.purchase_cost;
      return sum + (cost || 0);
    }, 0);
  };

  const getTotalSharpeningCost = () => {
    return sharpeningRecords.reduce((sum, record) => {
      const cost = typeof record.actual_cost === 'string' ? parseFloat(record.actual_cost) : record.actual_cost;
      return sum + (cost || 0);
    }, 0);
  };

  const getAverageSharpeningCost = () => {
    const recordsWithCost = sharpeningRecords.filter((r) => r.actual_cost);
    if (recordsWithCost.length === 0) return 0;
    return getTotalSharpeningCost() / recordsWithCost.length;
  };

  const getCostPerCycle = () => {
    const totalCycles = dies.reduce((sum, die) => sum + (die.total_cycles || 0), 0);
    if (totalCycles === 0) return 0;
    return (getTotalPurchaseCost() + getTotalSharpeningCost()) / totalCycles;
  };

  const getMostExpensiveDies = () => {
    return [...dies]
      .map((die) => {
        const purchaseCost = typeof die.purchase_cost === 'string' ? parseFloat(die.purchase_cost) : die.purchase_cost;
        const sharpeningCost = sharpeningRecords
          .filter((r) => r.die_id === die.die_id)
          .reduce((sum, r) => {
            const cost = typeof r.actual_cost === 'string' ? parseFloat(r.actual_cost) : r.actual_cost;
            return sum + (cost || 0);
          }, 0);
        return {
          ...die,
          totalCost: (purchaseCost || 0) + sharpeningCost,
          sharpeningCost,
          purchase_cost: purchaseCost || 0,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);
  };

  const getCostTrend = () => {
    const recentCost = sharpeningRecords
      .slice(-5)
      .reduce((sum, r) => sum + (r.actual_cost || 0), 0) / 5;
    const olderCost = sharpeningRecords
      .slice(0, 5)
      .reduce((sum, r) => sum + (r.actual_cost || 0), 0) / 5;
    return recentCost > olderCost ? 'up' : 'down';
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
          Cost Analysis
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
            <AttachMoney sx={{ fontSize: 40, color: '#FF6B35', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Total Purchase Cost
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FF6B35' }}>
              ${getTotalPurchaseCost().toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FFF3E0' }}>
            <AttachMoney sx={{ fontSize: 40, color: '#FF9800', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Total Sharpening Cost
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
              ${getTotalSharpeningCost().toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#E8F5E9' }}>
            <AttachMoney sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Avg Sharpening Cost
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
              ${getAverageSharpeningCost().toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#F3E5F5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              {getCostTrend() === 'up' ? (
                <TrendingUp sx={{ fontSize: 40, color: '#F44336' }} />
              ) : (
                <TrendingDown sx={{ fontSize: 40, color: '#4CAF50' }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Cost Per Cycle
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9C27B0' }}>
              ${getCostPerCycle().toFixed(3)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Most Expensive Dies (Lifetime Cost)
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell><strong>Die Number</strong></TableCell>
                <TableCell><strong>Die Name</strong></TableCell>
                <TableCell align="right"><strong>Purchase Cost</strong></TableCell>
                <TableCell align="right"><strong>Sharpening Cost</strong></TableCell>
                <TableCell align="center"><strong>Sharpenings</strong></TableCell>
                <TableCell align="right"><strong>Total Cost</strong></TableCell>
                <TableCell align="right"><strong>Cost/Cycle</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getMostExpensiveDies().map((die) => (
                <TableRow key={die.die_id} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: '#FF6B35' }}>
                    {die.die_number}
                  </TableCell>
                  <TableCell>{die.die_name}</TableCell>
                  <TableCell align="right">${(die.purchase_cost || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">${die.sharpeningCost.toFixed(2)}</TableCell>
                  <TableCell align="center">{die.sharpenings_count || 0}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    ${die.totalCost.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    {die.total_cycles > 0
                      ? `$${(die.totalCost / die.total_cycles).toFixed(3)}`
                      : 'N/A'}
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
              Cost Breakdown
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Purchase Costs</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${getTotalPurchaseCost().toFixed(2)} (
                  {(
                    (getTotalPurchaseCost() /
                      (getTotalPurchaseCost() + getTotalSharpeningCost())) *
                    100
                  ).toFixed(1)}
                  %)
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 24,
                  bgcolor: '#e0e0e0',
                  borderRadius: 1,
                  overflow: 'hidden',
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    width: `${
                      (getTotalPurchaseCost() /
                        (getTotalPurchaseCost() + getTotalSharpeningCost())) *
                      100
                    }%`,
                    height: '100%',
                    bgcolor: '#FF6B35',
                  }}
                />
              </Box>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Sharpening Costs</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${getTotalSharpeningCost().toFixed(2)} (
                  {(
                    (getTotalSharpeningCost() /
                      (getTotalPurchaseCost() + getTotalSharpeningCost())) *
                    100
                  ).toFixed(1)}
                  %)
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 24,
                  bgcolor: '#e0e0e0',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${
                      (getTotalSharpeningCost() /
                        (getTotalPurchaseCost() + getTotalSharpeningCost())) *
                      100
                    }%`,
                    height: '100%',
                    bgcolor: '#FF9800',
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              ROI Analysis
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Investment
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  ${(getTotalPurchaseCost() + getTotalSharpeningCost()).toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Cycles Produced
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {dies.reduce((sum, die) => sum + (die.total_cycles || 0), 0).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Average Cost per Die
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  $
                  {dies.length > 0
                    ? ((getTotalPurchaseCost() + getTotalSharpeningCost()) / dies.length).toFixed(
                        2
                      )
                    : '0.00'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CostAnalysisReport;
