import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
  Divider,
} from '@mui/material';
import {
  LocalShipping,
  Inventory,
  CheckCircle,
  Visibility,
  AttachFile,
  Add,
  Schedule,
  ArrowForward,
  Build,
} from '@mui/icons-material';
import axios from 'axios';
import socket from '../../services/socket';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface SharpeningRecord {
  sharpening_id: number;
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  sharpening_vendor: string;
  status: string;
  scheduled_date: string;
  shipped_date?: string;
  expected_return_date: string;
  actual_return_date?: string;
  quoted_cost?: number;
  actual_cost?: number;
  turnaround_days?: number;
}

interface SharpeningQueueListProps {
  onScheduleSharpening: () => void;
  onViewDetails: (sharpeningId: number) => void;
  onShip: (record: SharpeningRecord) => void;
  onReceive: (record: SharpeningRecord) => void;
  onAttachDocument: (record: SharpeningRecord) => void;
}

const statusConfig = [
  { key: 'SCHEDULED', label: 'Scheduled', color: '#FF9800', bgColor: '#FFF3E0', icon: Schedule },
  { key: 'SHIPPED', label: 'Shipped', color: '#2196F3', bgColor: '#E3F2FD', icon: LocalShipping },
  { key: 'AT_VENDOR', label: 'At Vendor', color: '#9C27B0', bgColor: '#F3E5F5', icon: Build },
  { key: 'RETURNED', label: 'Completed', color: '#4CAF50', bgColor: '#E8F5E9', icon: CheckCircle },
];

const SharpeningQueueList: React.FC<SharpeningQueueListProps> = ({
  onScheduleSharpening,
  onViewDetails,
  onShip,
  onReceive,
  onAttachDocument,
}) => {
  const [allRecords, setAllRecords] = useState<SharpeningRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllRecords();
  }, []);

  // Listen for real-time sharpening updates
  useEffect(() => {
    const handleDieUpdate = (data: any) => {
      if (data.action?.startsWith('sharpening') || data.sharpening_record) {
        console.log('Sharpening update received:', data);
        fetchAllRecords();
      }
    };

    socket.on('die_updated', handleDieUpdate);
    return () => {
      socket.off('die_updated', handleDieUpdate);
    };
  }, []);

  const fetchAllRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all records (no status filter)
      const response = await axios.get(`${API_URL}/die-sharpening`, { headers });
      setAllRecords(response.data);
    } catch (error) {
      console.error('Error fetching sharpening records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordsByStatus = (status: string) => {
    return allRecords.filter(r => r.status === status);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysElapsed = (scheduledDate: string, shippedDate?: string) => {
    const start = new Date(shippedDate || scheduledDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (record: SharpeningRecord) => {
    return record.expected_return_date &&
      new Date(record.expected_return_date) < new Date() &&
      record.status !== 'RETURNED';
  };

  const totalActive = allRecords.filter(r => r.status !== 'RETURNED').length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333' }}>
            Sharpening Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalActive} die{totalActive !== 1 ? 's' : ''} currently in sharpening process
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onScheduleSharpening}
          sx={{
            bgcolor: '#FF6600',
            '&:hover': { bgcolor: '#E55A00' },
            px: 3,
            py: 1,
          }}
        >
          Schedule Sharpening
        </Button>
      </Box>

      {/* Status Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {statusConfig.map((status) => {
          const count = getRecordsByStatus(status.key).length;
          const StatusIcon = status.icon;
          return (
            <Paper
              key={status.key}
              elevation={0}
              sx={{
                flex: 1,
                p: 2,
                bgcolor: status.bgColor,
                borderLeft: `4px solid ${status.color}`,
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: status.color }}>
                    {count}
                  </Typography>
                  <Typography variant="body2" sx={{ color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </Typography>
                </Box>
                <StatusIcon sx={{ fontSize: 40, color: status.color, opacity: 0.5 }} />
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Kanban Columns */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {statusConfig.map((status, index) => {
          const records = getRecordsByStatus(status.key);
          const StatusIcon = status.icon;

          return (
            <Paper
              key={status.key}
              elevation={1}
              sx={{
                flex: 1,
                minWidth: 280,
                maxWidth: 320,
                bgcolor: '#fafafa',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 500,
              }}
            >
              {/* Column Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: status.color,
                  color: 'white',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StatusIcon />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {status.label}
                  </Typography>
                </Box>
                <Chip
                  label={records.length}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                />
              </Box>

              {/* Column Content */}
              <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
                {records.length === 0 ? (
                  <Box
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      color: 'text.secondary',
                      bgcolor: 'white',
                      borderRadius: 1,
                      border: '2px dashed #e0e0e0',
                    }}
                  >
                    <Typography variant="body2">No dies</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {records.map((record) => {
                      const daysElapsed = getDaysElapsed(record.scheduled_date, record.shipped_date);
                      const overdue = isOverdue(record);

                      return (
                        <Card
                          key={record.sharpening_id}
                          elevation={2}
                          sx={{
                            borderRadius: 2,
                            border: overdue ? '2px solid #F44336' : '1px solid #e0e0e0',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 4,
                            },
                          }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            {/* Die Info */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 'bold', color: '#0066A1' }}
                                >
                                  Die #{record.die_number}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {record.die_type}
                                </Typography>
                              </Box>
                              {overdue && (
                                <Chip
                                  label="OVERDUE"
                                  size="small"
                                  sx={{
                                    bgcolor: '#F44336',
                                    color: 'white',
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                  }}
                                />
                              )}
                            </Box>

                            {/* Vendor & Dates */}
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" display="block" color="text.secondary">
                                <strong>Vendor:</strong> {record.sharpening_vendor}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                <strong>Expected:</strong> {formatDate(record.expected_return_date)}
                              </Typography>
                            </Box>

                            {/* Days Chip */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Chip
                                label={`${daysElapsed} day${daysElapsed !== 1 ? 's' : ''}`}
                                size="small"
                                sx={{
                                  bgcolor: daysElapsed > 14 ? '#F44336' : daysElapsed > 7 ? '#FF9800' : '#4CAF50',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                }}
                              />

                              {/* Action Buttons */}
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => onViewDetails(record.sharpening_id)}
                                    sx={{ color: '#666' }}
                                  >
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>

                                {record.status === 'SCHEDULED' && (
                                  <Tooltip title="Mark as Shipped">
                                    <IconButton
                                      size="small"
                                      onClick={() => onShip(record)}
                                      sx={{
                                        bgcolor: '#2196F3',
                                        color: 'white',
                                        '&:hover': { bgcolor: '#1976D2' },
                                      }}
                                    >
                                      <ArrowForward fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                {record.status === 'SHIPPED' && (
                                  <Tooltip title="Mark as Received by Vendor">
                                    <IconButton
                                      size="small"
                                      onClick={() => onReceive(record)}
                                      sx={{
                                        bgcolor: '#9C27B0',
                                        color: 'white',
                                        '&:hover': { bgcolor: '#7B1FA2' },
                                      }}
                                    >
                                      <ArrowForward fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                {record.status === 'AT_VENDOR' && (
                                  <Tooltip title="Mark as Returned">
                                    <IconButton
                                      size="small"
                                      onClick={() => onReceive(record)}
                                      sx={{
                                        bgcolor: '#4CAF50',
                                        color: 'white',
                                        '&:hover': { bgcolor: '#388E3C' },
                                      }}
                                    >
                                      <CheckCircle fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default SharpeningQueueList;
