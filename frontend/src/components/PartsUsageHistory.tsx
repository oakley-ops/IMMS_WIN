import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import DownloadIcon from '@mui/icons-material/Download';
import axios from '../utils/axios';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

interface UsageRecord {
  transaction_id: number;
  part_id: number;
  part_name: string;
  machine_id: number | null;
  machine_name: string | null;
  quantity: number;
  usage_date: string;
  reason: string;
  unit_cost: string | null;
  fiserv_part_number: string;
}

interface PartsUsageHistoryProps {
  limit?: number;
}

const PartsUsageHistory: React.FC<PartsUsageHistoryProps> = ({ limit }) => {
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchUsageHistory = async () => {
    try {
      const response = await axios.get('/api/v1/parts/usage/history', {
        params: { 
          startDate: startDate?.format('YYYY-MM-DD'),
          endDate: endDate?.format('YYYY-MM-DD')
        }
      });
      
      console.log('API Response:', {
        data: response.data,
        firstRecord: response.data[0],
        recordCount: response.data.length
      });

      if (response.data && response.data.length > 0) {
        const firstRecord = response.data[0];
        console.log('Sample Record Details:', {
          transaction_id: firstRecord.transaction_id,
          part_name: firstRecord.part_name,
          unit_cost: firstRecord.unit_cost,
          quantity: firstRecord.quantity,
          calculated_total: firstRecord.unit_cost * Math.abs(firstRecord.quantity)
        });
      }
      
      const records = response.data;
      setUsageHistory(records);
      setError(null);
    } catch (err) {
      console.error('Error fetching usage history:', err);
      setError('Failed to load usage history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchUsageHistory();
    }
  }, [startDate, endDate]);

  const calculateTotalCost = (record: UsageRecord) => {
    console.log('Calculating total cost for record:', {
      transaction_id: record.transaction_id,
      part_name: record.part_name,
      unit_cost: record.unit_cost,
      unit_cost_type: typeof record.unit_cost,
      quantity: record.quantity,
      raw_record: record
    });
    
    if (!record.unit_cost) {
      console.log('No unit cost available for:', record.part_name);
      return '-';
    }
    
    const unitCost = parseFloat(record.unit_cost);
    if (isNaN(unitCost)) {
      console.log('Invalid unit cost:', record.unit_cost);
      return '-';
    }
    
    const cost = unitCost * Math.abs(record.quantity);
    const formattedCost = `$${cost.toFixed(2)}`;
    console.log('Cost calculation result:', {
      unitCost,
      quantity: record.quantity,
      cost,
      formattedCost
    });
    return formattedCost;
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      setExportLoading(true);
      const response = await axios.get('/api/v1/parts/usage/history', {
        params: {
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD')
        }
      });

      const data = response.data;
      console.log('Preparing export data:', data);
      
      // Transform data for export
      const exportData = data.map((record: UsageRecord) => {
        const totalCost = calculateTotalCost(record);
        console.log('Export record:', {
          part_name: record.part_name,
          unit_cost: record.unit_cost,
          quantity: record.quantity,
          total_cost: totalCost
        });
        
        return {
          'Date': dayjs(record.usage_date).format('MM/DD/YYYY'),
          'Part Name': record.part_name,
          'Fiserv Part #': record.fiserv_part_number,
          'Machine Name': record.machine_name || 'N/A',
          'Quantity Used': Math.abs(record.quantity),
          'Type': record.reason,
          'Total Cost': totalCost
        };
      });

      console.log('Final export data:', exportData);

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 15 }, // Date
        { wch: 30 }, // Part Name
        { wch: 20 }, // Fiserv Part #
        { wch: 25 }, // Machine Name
        { wch: 15 }, // Quantity Used
        { wch: 15 }, // Type
        { wch: 15 }, // Total Cost
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Usage History');

      // Generate filename with date range
      const filename = `parts_usage_${startDate.format('YYYYMMDD')}_to_${endDate.format('YYYYMMDD')}.xlsx`;
      
      // Export file
      XLSX.writeFile(workbook, filename);
      setExportDialogOpen(false);
      setStartDate(null);
      setEndDate(null);
    } catch (err) {
      console.error('Error exporting usage history:', err);
      setError('Failed to export usage history');
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = dayjs(dateString);
    return date.format('MMM D, YYYY h:mm A');
  };

  const getQuantityDisplay = (record: UsageRecord) => {
    const isRestock = record.reason === 'Restock';
    const quantity = Math.abs(record.quantity);
    const color = isRestock ? 'success' : 'primary';
    const prefix = isRestock ? '+' : '-';

    return (
      <Chip 
        label={`${prefix}${quantity}`}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%', p: 2 }}>
        <Box sx={{ 
          mb: 3, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'background.paper',
          padding: 2,
          borderRadius: 1
        }}>
          <Typography variant="h6" component="h2">
            Parts Usage History
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              maxDate={endDate || undefined}
              sx={{ width: 200 }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              minDate={startDate || undefined}
              sx={{ width: 200 }}
            />
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<DownloadIcon />}
              onClick={() => setExportDialogOpen(true)}
              sx={{ 
                minWidth: '140px',
                '&:hover': {
                  backgroundColor: 'primary.dark'
                }
              }}
            >
              Export
            </Button>
          </Box>
        </Box>

        <TableContainer 
          component={Paper} 
          sx={{ 
            mt: 2,
            width: '100%',
            maxWidth: '100%',
            overflowX: 'auto',
            '& .MuiTable-root': {
              tableLayout: 'fixed',
              width: '100%'
            },
            '& .MuiTableCell-root': {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              borderRight: '1px solid rgba(224, 224, 224, 1)',
              '&:last-child': {
                borderRight: 'none'
              }
            }
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '20%' }}>Date</TableCell>
                <TableCell sx={{ width: '25%' }}>Part Name</TableCell>
                <TableCell sx={{ width: '20%' }}>Fiserv Part #</TableCell>
                <TableCell sx={{ width: '20%' }}>Machine</TableCell>
                <TableCell sx={{ width: '15%' }} align="right">Total Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usageHistory.map((record) => {
                const totalCost = calculateTotalCost(record);
                console.log('Rendering record:', {
                  id: record.transaction_id,
                  part_name: record.part_name,
                  unit_cost: record.unit_cost,
                  quantity: record.quantity,
                  total_cost: totalCost
                });
                return (
                  <TableRow key={record.transaction_id}>
                    <TableCell>{formatDate(record.usage_date)}</TableCell>
                    <TableCell>{record.part_name}</TableCell>
                    <TableCell>{record.fiserv_part_number}</TableCell>
                    <TableCell>{record.machine_name || '-'}</TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        pr: 3,
                        color: 'text.primary',
                        fontWeight: 'medium'
                      }}
                    >
                      {totalCost}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!usageHistory || usageHistory.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No usage history found. Please select a date range to view the history.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Export Dialog */}
        <Dialog 
          open={exportDialogOpen} 
          onClose={() => setExportDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Export Usage History</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                maxDate={endDate || undefined}
                sx={{ width: '100%' }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate || undefined}
                sx={{ width: '100%' }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button 
              onClick={() => setExportDialogOpen(false)}
              size="large"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              variant="contained"
              disabled={!startDate || !endDate || exportLoading}
              startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
              size="large"
            >
              Export
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default PartsUsageHistory;
