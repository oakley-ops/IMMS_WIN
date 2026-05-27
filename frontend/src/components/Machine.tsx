import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  serial_number: string;
  location?: string;
  manufacturer?: string;
  status?: string;
  installation_date?: string;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string;
  notes?: string;
}

interface Part {
  part_id: number;
  name: string;
  quantity: number;
  minimum_quantity: number;
  manufacturer_part_number: string;
  internal_part_number: string;
}

interface PartsUsage {
  part_id: number;
  part_name: string;
  internal_part_number: string;
  manufacturer_part_number: string;
  total_quantity_used: number;
  total_cost: number;
  usage_count: number;
  first_usage_date: string;
  last_usage_date: string;
}

interface TimelineData {
  month: string;
  monthly_cost: number;
  parts_count: number;
  parts_quantity: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
  </div>
);

const getPartStockColor = (quantity: number, minimum: number): 'error' | 'warning' | 'success' => {
  if (quantity === 0) return 'error';
  if (quantity <= minimum) return 'warning';
  return 'success';
};

const getPartStockLabel = (quantity: number, minimum: number): string => {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= minimum) return 'Low Stock';
  return 'In Stock';
};

const Machine: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [partsUsage, setPartsUsage] = useState<PartsUsage[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [totalPartsCost, setTotalPartsCost] = useState(0);

  useEffect(() => {
    if (!id || isNaN(parseInt(id))) {
      setError('Invalid machine ID');
      setLoading(false);
      return;
    }
    fetchMachineDetails();
  }, [id]);

  const fetchMachineDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const [machineResponse, partsResponse, partsUsageResponse, timelineResponse] = await Promise.all([
        axios.get<Machine>(`${API_URL}/api/v1/machines/${id}`),
        axios.get<Part[]>(`${API_URL}/api/v1/machines/${id}/parts`),
        axios.get<PartsUsage[]>(`${API_URL}/api/v1/machines/${id}/parts-usage`),
        axios.get<TimelineData[]>(`${API_URL}/api/v1/machines/${id}/usage-timeline`)
      ]);

      setMachine(machineResponse.data);
      setParts(partsResponse.data);
      setPartsUsage(partsUsageResponse.data);

      const formattedTimelineData = timelineResponse.data.map((item: any) => ({
        ...item,
        month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthly_cost: parseFloat(item.monthly_cost)
      }));
      setTimelineData(formattedTimelineData);

      const totalCost = partsUsageResponse.data.reduce((sum, item) =>
        sum + parseFloat(item.total_cost.toString()), 0);
      setTotalPartsCost(totalCost);

      setError(null);
    } catch (error: any) {
      console.error('Error fetching machine details:', error);
      if (error.response?.status === 404) {
        setError('Machine not found');
      } else {
        setError(error.response?.data?.message || error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `$${numValue.toFixed(2)}`;
  };

  const getDaysDifference = (date: string): number => {
    const now = new Date();
    const targetDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - targetDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isDateInPast = (date: string): boolean => {
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 3 }}
        action={
          <Button color="inherit" size="small" onClick={() => navigate('/machines')}>
            Back to Machines
          </Button>
        }
      >
        <Typography fontWeight="bold">Error</Typography>
        {error}
      </Alert>
    );
  }

  if (!machine) {
    return (
      <Alert severity="warning" sx={{ mt: 3 }}
        action={
          <Button color="inherit" size="small" onClick={() => navigate('/machines')}>
            Back to Machines
          </Button>
        }
      >
        <Typography fontWeight="bold">No Data</Typography>
        Machine information not available.
      </Alert>
    );
  }

  return (
    <Box>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h3">{machine.name}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/machines/${machine.machine_id}/edit`)}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => navigate('/machines')}
              >
                Back
              </Button>
            </Box>
          </Box>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="Machine Details" />
            <Tab label="Associated Parts" />
            <Tab label="Parts Usage Cost" />
          </Tabs>

          {/* Machine Details Tab */}
          <TabPanel value={activeTab} index={0}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>Machine ID</TableCell>
                    <TableCell>{machine.machine_id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Model Number</TableCell>
                    <TableCell>{machine.model || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Serial Number</TableCell>
                    <TableCell>{machine.serial_number || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Manufacturer</TableCell>
                    <TableCell>{machine.manufacturer || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Location</TableCell>
                    <TableCell>{machine.location || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={machine.status || 'Unknown'}
                        color={machine.status === 'Active' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Installation Date</TableCell>
                    <TableCell>{formatDate(machine.installation_date)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Last Maintenance</TableCell>
                    <TableCell>
                      {machine.last_maintenance_date ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDate(machine.last_maintenance_date)}
                          <Chip
                            label={`${getDaysDifference(machine.last_maintenance_date)} days ago`}
                            color="info"
                            size="small"
                          />
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>Next Maintenance</TableCell>
                    <TableCell>
                      {machine.next_maintenance_date ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDate(machine.next_maintenance_date)}
                          {!isDateInPast(machine.next_maintenance_date) ? (
                            <Chip
                              label={`In ${getDaysDifference(machine.next_maintenance_date)} days`}
                              color="success"
                              size="small"
                            />
                          ) : (
                            <Chip
                              label={`Overdue by ${getDaysDifference(machine.next_maintenance_date)} days`}
                              color="error"
                              size="small"
                            />
                          )}
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                  </TableRow>
                  {machine.notes && (
                    <TableRow>
                      <TableCell component="th" sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                      <TableCell>{machine.notes}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Associated Parts Tab */}
          <TabPanel value={activeTab} index={1}>
            {parts.length === 0 ? (
              <Alert severity="info">No parts associated with this machine.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Part Name</TableCell>
                      <TableCell>Internal Part #</TableCell>
                      <TableCell>Manufacturer Part #</TableCell>
                      <TableCell align="right">Current Quantity</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parts.map((part) => (
                      <TableRow key={part.part_id}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>{part.internal_part_number}</TableCell>
                        <TableCell>{part.manufacturer_part_number}</TableCell>
                        <TableCell align="right">{part.quantity}</TableCell>
                        <TableCell>
                          <Chip
                            label={getPartStockLabel(part.quantity, part.minimum_quantity)}
                            color={getPartStockColor(part.quantity, part.minimum_quantity)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/parts/${part.part_id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Parts Usage Cost Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Parts Usage Summary</Typography>
                <Typography variant="h6">
                  Total Cost:{' '}
                  <Chip label={formatCurrency(totalPartsCost)} color="primary" />
                </Typography>
              </Box>

              {partsUsage.length === 0 ? (
                <Alert severity="info">No parts usage history for this machine.</Alert>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Part Name</TableCell>
                          <TableCell>Internal Part #</TableCell>
                          <TableCell align="right">Total Quantity Used</TableCell>
                          <TableCell align="right">Total Cost</TableCell>
                          <TableCell align="right">Usage Count</TableCell>
                          <TableCell align="right">Last Used</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {partsUsage.map((usage) => (
                          <TableRow key={usage.part_id}>
                            <TableCell>{usage.part_name}</TableCell>
                            <TableCell>{usage.internal_part_number}</TableCell>
                            <TableCell align="right">{usage.total_quantity_used}</TableCell>
                            <TableCell align="right">{formatCurrency(usage.total_cost)}</TableCell>
                            <TableCell align="right">{usage.usage_count}</TableCell>
                            <TableCell align="right">{formatDate(usage.last_usage_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Monthly Cost Trend</Typography>
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip formatter={(value) => typeof value === 'number' ? `$${value.toFixed(2)}` : value} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="monthly_cost" name="Monthly Cost" fill="#8884d8" />
                        <Bar yAxisId="right" dataKey="parts_quantity" name="Parts Quantity" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No timeline data available.</Alert>
                  )}
                </>
              )}
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Machine;
