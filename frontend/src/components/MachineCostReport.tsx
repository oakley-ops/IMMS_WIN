import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Box,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import dayjs, { Dayjs } from 'dayjs';
import axios from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import ExcelJS from 'exceljs';

interface MachineCost {
  machine_id: number;
  machine_name: string;
  model: string;
  serial_number: string;
  location: string;
  total_parts_cost: number;
  unique_parts_used: number;
  total_parts_quantity: number;
  first_usage_date: string;
  last_usage_date: string;
}

interface TimelineData {
  month: string;
  monthly_cost: number;
  parts_count: number;
  parts_quantity: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#6B66FF'];

const MachineCostReport: React.FC = () => {
  const [machines, setMachines] = useState<MachineCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(6, 'month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [exportLoading, setExportLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchMachineCosts();
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      fetchMachineTimeline();
    }
  }, [selectedMachine, startDate, endDate]);

  const fetchMachineCosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/v1/machines/costs');
      setMachines(response.data);
      if (response.data.length > 0) {
        setSelectedMachine(response.data[0].machine_id);
      }
    } catch (err) {
      console.error('Error fetching machine costs:', err);
      setError('Failed to load machine cost data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineTimeline = async () => {
    if (!selectedMachine) return;
    
    try {
      const response = await axios.get(`/api/v1/machines/${selectedMachine}/usage-timeline`, {
        params: {
          startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
          endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined
        }
      });
      
      // Format the data for the chart
      const formattedData = response.data.map((item: any) => ({
        ...item,
        month: dayjs(item.month).format('MMM YYYY'),
        monthly_cost: parseFloat(item.monthly_cost)
      }));
      
      setTimelineData(formattedData);
    } catch (err) {
      console.error('Error fetching machine timeline:', err);
    }
  };

  const handleMachineSelect = (event: SelectChangeEvent<number>) => {
    setSelectedMachine(event.target.value as number);
  };

  const handleViewDetails = (machineId: number) => {
    navigate(`/machines/${machineId}`);
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Machine Cost Report');
      
      // Add title
      const titleRow = worksheet.addRow(['Machine Parts Cost Report']);
      titleRow.font = { bold: true, size: 16 };
      worksheet.mergeCells(`A1:H1`);
      
      // Add date range
      const dateRangeRow = worksheet.addRow([
        `Report Date: ${dayjs().format('MM/DD/YYYY')}`
      ]);
      worksheet.mergeCells(`A2:H2`);
      
      // Add empty row
      worksheet.addRow([]);
      
      // Add headers
      const headers = [
        'Machine Name', 
        'Model', 
        'Serial Number', 
        'Location', 
        'Total Parts Cost', 
        'Unique Parts Used',
        'Total Parts Quantity',
        'Last Usage Date'
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '4472C4' }
        };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true };
      });
      
      // Add data
      machines.forEach((machine) => {
        worksheet.addRow([
          machine.machine_name,
          machine.model || 'N/A',
          machine.serial_number || 'N/A',
          machine.location || 'N/A',
          machine.total_parts_cost ? `$${parseFloat(machine.total_parts_cost.toString()).toFixed(2)}` : '$0.00',
          machine.unique_parts_used || 0,
          machine.total_parts_quantity || 0,
          machine.last_usage_date ? dayjs(machine.last_usage_date).format('MM/DD/YYYY') : 'N/A'
        ]);
      });
      
      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        column.width = 20;
      });
      
      // Generate buffer and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `machine_cost_report_${dayjs().format('YYYYMMDD')}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting report:', err);
      setError('Failed to export report');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value.toString()).toFixed(2)}`;
  };

  const renderBarChart = () => (
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
  );

  const renderPieChart = () => {
    // Prepare data for pie chart - top 5 months by cost
    const pieData = [...timelineData]
      .sort((a, b) => b.monthly_cost - a.monthly_cost)
      .slice(0, 5)
      .map(item => ({
        name: item.month,
        value: item.monthly_cost
      }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `$${parseFloat(value.toString()).toFixed(2)}`} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            Machine Parts Cost Report
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exporting...' : 'Export Report'}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Machine Name</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Total Parts Cost</TableCell>
                    <TableCell align="right">Unique Parts</TableCell>
                    <TableCell align="right">Total Quantity</TableCell>
                    <TableCell align="right">Last Usage</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {machines.map((machine) => (
                    <TableRow key={machine.machine_id}>
                      <TableCell>{machine.machine_name}</TableCell>
                      <TableCell>{machine.model || 'N/A'}</TableCell>
                      <TableCell>{machine.location || 'N/A'}</TableCell>
                      <TableCell align="right">{formatCurrency(machine.total_parts_cost)}</TableCell>
                      <TableCell align="right">{machine.unique_parts_used || 0}</TableCell>
                      <TableCell align="right">{machine.total_parts_quantity || 0}</TableCell>
                      <TableCell align="right">
                        {machine.last_usage_date 
                          ? dayjs(machine.last_usage_date).format('MM/DD/YYYY') 
                          : 'N/A'}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewDetails(machine.machine_id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      {/* Machine Cost Timeline Chart */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Machine Parts Cost Timeline
        </Typography>
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="machine-select-label">Select Machine</InputLabel>
              <Select
                labelId="machine-select-label"
                value={selectedMachine || ''}
                label="Select Machine"
                onChange={handleMachineSelect}
              >
                {machines.map((machine) => (
                  <MenuItem key={machine.machine_id} value={machine.machine_id}>
                    {machine.machine_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={chartType === 'bar' ? 'contained' : 'outlined'}
                startIcon={<BarChartIcon />}
                onClick={() => setChartType('bar')}
                fullWidth
              >
                Bar
              </Button>
              <Button
                variant={chartType === 'pie' ? 'contained' : 'outlined'}
                startIcon={<PieChartIcon />}
                onClick={() => setChartType('pie')}
                fullWidth
              >
                Pie
              </Button>
            </Box>
          </Grid>
        </Grid>

        {timelineData.length > 0 ? (
          chartType === 'bar' ? renderBarChart() : renderPieChart()
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography variant="body1" color="text.secondary">
              No data available for the selected period
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default MachineCostReport; 