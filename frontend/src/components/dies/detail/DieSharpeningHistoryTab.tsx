import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Visibility, AttachFile } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface DieSharpeningHistoryTabProps {
  dieId: number;
}

const DieSharpeningHistoryTab: React.FC<DieSharpeningHistoryTabProps> = ({ dieId }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchSharpeningHistory();
  }, [dieId]);

  const fetchSharpeningHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_URL}/die-sharpening`, {
        headers,
        params: { die_id: dieId },
      });
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching sharpening history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      SCHEDULED: '#FF9800',
      SHIPPED: '#2196F3',
      AT_VENDOR: '#9C27B0',
      COMPLETED: '#4CAF50',
      RETURNED: '#4CAF50',
    };
    return colors[status] || '#9E9E9E';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (records.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">No sharpening history recorded yet.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Date Scheduled</strong></TableCell>
              <TableCell><strong>Vendor</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Shipped</strong></TableCell>
              <TableCell><strong>Returned</strong></TableCell>
              <TableCell align="right"><strong>Cost</strong></TableCell>
              <TableCell><strong>Condition</strong></TableCell>
              <TableCell align="center"><strong>Turnaround</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.sharpening_id} hover>
                <TableCell>{formatDate(record.scheduled_date)}</TableCell>
                <TableCell>{record.sharpening_vendor}</TableCell>
                <TableCell>
                  <Chip
                    label={record.status.replace(/_/g, ' ')}
                    size="small"
                    sx={{
                      bgcolor: getStatusColor(record.status),
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                </TableCell>
                <TableCell>{formatDate(record.shipped_date)}</TableCell>
                <TableCell>{formatDate(record.actual_return_date)}</TableCell>
                <TableCell align="right">
                  {record.actual_cost
                    ? `$${record.actual_cost.toFixed(2)}`
                    : record.quoted_cost
                    ? `~$${record.quoted_cost.toFixed(2)}`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Box>
                    {record.condition_before && (
                      <Typography variant="caption" color="text.secondary">
                        Before: {record.condition_before}
                      </Typography>
                    )}
                    {record.condition_after && (
                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                        After: {record.condition_after}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {record.turnaround_days ? (
                    <Chip
                      label={`${record.turnaround_days} days`}
                      size="small"
                      sx={{
                        bgcolor:
                          record.turnaround_days > 14
                            ? '#F44336'
                            : record.turnaround_days > 7
                            ? '#FF9800'
                            : '#4CAF50',
                        color: 'white',
                      }}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View Details">
                    <IconButton size="small" color="primary">
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Documents">
                    <IconButton size="small" color="primary">
                      <AttachFile fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Sharpening Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Sharpenings
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {records.length}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Average Turnaround
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {records.filter((r) => r.turnaround_days).length > 0
                ? (
                    records.reduce((sum, r) => sum + (r.turnaround_days || 0), 0) /
                    records.filter((r) => r.turnaround_days).length
                  ).toFixed(1)
                : '0'}{' '}
              days
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Cost
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              $
              {records
                .reduce((sum, r) => sum + (r.actual_cost || 0), 0)
                .toFixed(2)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Average Cost
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              $
              {records.filter((r) => r.actual_cost).length > 0
                ? (
                    records.reduce((sum, r) => sum + (r.actual_cost || 0), 0) /
                    records.filter((r) => r.actual_cost).length
                  ).toFixed(2)
                : '0.00'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DieSharpeningHistoryTab;
