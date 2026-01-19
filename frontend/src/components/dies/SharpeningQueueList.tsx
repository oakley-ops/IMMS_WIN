import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  LocalShipping,
  Inventory,
  CheckCircle,
  Visibility,
  AttachFile,
  Add,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

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

const SharpeningQueueList: React.FC<SharpeningQueueListProps> = ({
  onScheduleSharpening,
  onViewDetails,
  onShip,
  onReceive,
  onAttachDocument,
}) => {
  const [records, setRecords] = useState<SharpeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const statusTabs = [
    { label: 'Scheduled', value: 'SCHEDULED', color: '#FF9800' },
    { label: 'Shipped', value: 'SHIPPED', color: '#2196F3' },
    { label: 'At Vendor', value: 'AT_VENDOR', color: '#9C27B0' },
    { label: 'Completed', value: 'RETURNED', color: '#4CAF50' },
  ];

  useEffect(() => {
    fetchRecords();
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const status = statusTabs[activeTab].value;

      const response = await axios.get(`${API_URL}/die-sharpening`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status },
      });

      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching sharpening records:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysElapsed = (scheduledDate: string, shippedDate?: string) => {
    const start = new Date(shippedDate || scheduledDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return days;
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

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Sharpening Queue
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onScheduleSharpening}
            sx={{
              bgcolor: '#FF6600',
              '&:hover': { bgcolor: '#E55A00' },
            }}
          >
            Schedule Sharpening
          </Button>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            {statusTabs.map((tab, index) => (
              <Tab
                key={tab.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {tab.label}
                    <Chip
                      label={records.filter((r) => r.status === tab.value).length}
                      size="small"
                      sx={{
                        bgcolor: tab.color,
                        color: 'white',
                        height: 20,
                        minWidth: 20,
                      }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Die Number</strong></TableCell>
                  <TableCell><strong>Die Name</strong></TableCell>
                  <TableCell><strong>Vendor</strong></TableCell>
                  <TableCell><strong>Scheduled Date</strong></TableCell>
                  {activeTab >= 1 && <TableCell><strong>Shipped Date</strong></TableCell>}
                  <TableCell><strong>Expected Return</strong></TableCell>
                  {activeTab === 3 && <TableCell><strong>Actual Return</strong></TableCell>}
                  <TableCell align="center"><strong>Days Elapsed</strong></TableCell>
                  <TableCell align="right"><strong>Cost</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No dies in {statusTabs[activeTab].label.toLowerCase()} status
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => {
                    const daysElapsed = getDaysElapsed(
                      record.scheduled_date,
                      record.shipped_date
                    );
                    const isOverdue =
                      record.expected_return_date &&
                      new Date(record.expected_return_date) < new Date() &&
                      record.status !== 'RETURNED';

                    return (
                      <TableRow key={record.sharpening_id} hover>
                        <TableCell sx={{ fontWeight: 'bold', color: '#0066A1' }}>
                          {record.die_number}
                        </TableCell>
                        <TableCell>{record.die_name}</TableCell>
                        <TableCell>{record.sharpening_vendor}</TableCell>
                        <TableCell>{formatDate(record.scheduled_date)}</TableCell>
                        {activeTab >= 1 && (
                          <TableCell>{formatDate(record.shipped_date)}</TableCell>
                        )}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {formatDate(record.expected_return_date)}
                            {isOverdue && (
                              <Chip
                                label="OVERDUE"
                                size="small"
                                sx={{
                                  bgcolor: '#F44336',
                                  color: 'white',
                                  height: 20,
                                  fontSize: '0.65rem',
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        {activeTab === 3 && (
                          <TableCell>{formatDate(record.actual_return_date)}</TableCell>
                        )}
                        <TableCell align="center">
                          <Chip
                            label={`${daysElapsed} days`}
                            size="small"
                            sx={{
                              bgcolor: daysElapsed > 14 ? '#F44336' : daysElapsed > 7 ? '#FF9800' : '#4CAF50',
                              color: 'white',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {activeTab === 3 && record.actual_cost
                            ? `$${record.actual_cost.toFixed(2)}`
                            : record.quoted_cost
                            ? `~$${record.quoted_cost.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => onViewDetails(record.sharpening_id)}
                                color="primary"
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Attach Document">
                              <IconButton
                                size="small"
                                onClick={() => onAttachDocument(record)}
                                color="primary"
                              >
                                <AttachFile fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {record.status === 'SCHEDULED' && (
                              <Tooltip title="Mark as Shipped">
                                <IconButton
                                  size="small"
                                  onClick={() => onShip(record)}
                                  sx={{ color: '#2196F3' }}
                                >
                                  <LocalShipping fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {record.status === 'SHIPPED' && (
                              <Tooltip title="Mark at Vendor">
                                <IconButton
                                  size="small"
                                  onClick={() => onReceive(record)}
                                  sx={{ color: '#9C27B0' }}
                                >
                                  <Inventory fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {record.status === 'AT_VENDOR' && (
                              <Tooltip title="Mark as Returned">
                                <IconButton
                                  size="small"
                                  onClick={() => onReceive(record)}
                                  sx={{ color: '#4CAF50' }}
                                >
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default SharpeningQueueList;
