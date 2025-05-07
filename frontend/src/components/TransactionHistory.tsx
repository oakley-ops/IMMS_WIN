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
  Chip,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import DownloadIcon from '@mui/icons-material/Download';
import dayjs from 'dayjs';
import axios from '../utils/axios';
import ExcelJS from 'exceljs';

interface Transaction {
  transaction_id: number;
  part_name: string;
  fiserv_part_number: string;
  machine_name: string | null;
  quantity: number;
  usage_date: string;
  reason: string;
  unit_cost: number;
}

const TransactionHistory: React.FC = () => {
  const [startDate, setStartDate] = useState<any>(null);
  const [endDate, setEndDate] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchTransactions = async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/v1/parts/usage/history', {
        params: {
          startDate: dayjs(startDate).format('YYYY-MM-DD'),
          endDate: dayjs(endDate).format('YYYY-MM-DD'),
        },
      });
      console.log('API Response:', response.data);
      setTransactions(response.data.map((transaction: any) => ({
        ...transaction,
        unit_cost: parseFloat(transaction.unit_cost)
      })));
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
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
          startDate: dayjs(startDate).format('YYYY-MM-DD'),
          endDate: dayjs(endDate).format('YYYY-MM-DD'),
        },
      });

      const data = response.data;
      
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Parts Usage History');

      // Add and style title row with new merging
      const titleRow = worksheet.addRow(['Parts Usage History Report', '', '', '', '', '']);
      worksheet.mergeCells(1, 1, 1, 2); // Merge A-B for title
      worksheet.mergeCells(1, 3, 1, 6); // Merge C-F for date
      
      // Style title row
      titleRow.height = 30;
      titleRow.font = { bold: true, size: 16 };
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      titleRow.getCell(3).value = `Date Range: ${dayjs(startDate).format('MM/DD/YYYY')} to ${dayjs(endDate).format('MM/DD/YYYY')}`;
      titleRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      // Add summary information right after title
      const totalQuantity: number = data.reduce((sum: number, record: Transaction) => sum + record.quantity, 0);
      const totalCost: number = data.reduce((sum: number, record: Transaction) => {
        const cost = typeof record.unit_cost === 'string' ? parseFloat(record.unit_cost) : record.unit_cost;
        return sum + (isNaN(cost) ? 0 : cost * Math.abs(record.quantity));
      }, 0);

      const summaryRow = worksheet.addRow(['Summary', '', '', '', `Total Items: ${Math.abs(totalQuantity)}`, `Total Cost: $${totalCost.toFixed(2)}`]);
      
      // Style summary row
      summaryRow.font = { bold: true };
      summaryRow.height = 20;
      summaryRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E5' }  // Light pink color
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      summaryRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      summaryRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

      // Define headers
      const headers = ['Date', 'Part Name', 'Fiserv Part #', 'Machine', 'Quantity', 'Unit Cost'];
      const headerRow = worksheet.addRow(headers);

      // Style headers
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      headerRow.height = 25;

      // Add data rows with alternating colors
      data.forEach((record: Transaction, index: number) => {
        const unitCost = typeof record.unit_cost === 'string' ? parseFloat(record.unit_cost) : record.unit_cost;
        const row = worksheet.addRow([
          dayjs(record.usage_date).format('MM/DD/YYYY'),
          record.part_name,
          record.fiserv_part_number,
          record.machine_name || 'N/A',
          record.quantity,
          isNaN(unitCost) ? 'N/A' : `$${unitCost.toFixed(2)}`
        ]);

        // Add alternating row colors
        if (index % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F5F5F5' }
            };
          });
        }

        // Add borders and alignment to all cells
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle' };
        });

        // Center specific columns
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }; // Machine
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' }; // Quantity
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };  // Unit Cost
      });

      // Set print settings
      worksheet.pageSetup.orientation = 'landscape';
      worksheet.pageSetup.fitToPage = true;
      worksheet.pageSetup.fitToWidth = 1;
      worksheet.pageSetup.fitToHeight = 1;
      worksheet.pageSetup.paperSize = 9; // A4 paper size
      worksheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      };

      // Set print area to only include columns A-F
      worksheet.pageSetup.printArea = 'A1:F' + (worksheet.rowCount);

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        const columnNumber = (index + 1) as number;
        
        // Set specific widths for all columns based on provided measurements
        switch(columnNumber) {
          case 1: // Date column
            column.width = 17.29;
            break;
          case 2: // Part Name
            column.width = 27.57;
            break;
          case 3: // Fiserv Part #
            column.width = 25.86;
            break;
          case 4: // Machine
            column.width = 20.86;
            break;
          case 5: // Quantity
            column.width = 13.71;
            break;
          case 6: // Unit Cost
            column.width = 17.43;
            break;
        }
      });

      // Generate filename with date range
      const filename = `parts_usage_${dayjs(startDate).format('YYYYMMDD')}_to_${dayjs(endDate).format('YYYYMMDD')}.xlsx`;
      
      // Generate buffer and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting usage history:', err);
      setError('Failed to export usage history');
    } finally {
      setExportLoading(false);
    }
  };

  const getQuantityDisplay = (quantity: number, reason: string) => {
    const isRestock = reason === 'Restock';
    const displayQuantity = Math.abs(quantity);
    const color = isRestock ? 'success' : 'error';
    const prefix = isRestock ? '+' : '-';

    return (
      <Chip 
        label={`${prefix}${displayQuantity}`}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="lg">
        <Box sx={{ width: '100%', p: 2 }}>
          <Typography variant="h5" gutterBottom>
            Parts Usage History
          </Typography>
          
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  maxDate={endDate || undefined}
                  sx={{ width: '100%' }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  minDate={startDate || undefined}
                  sx={{ width: '100%' }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={fetchTransactions}
                  disabled={!startDate || !endDate || loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Search'}
                </Button>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleExport}
                  disabled={!startDate || !endDate || loading || exportLoading}
                  startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                >
                  Export
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Part Name</TableCell>
                  <TableCell>Fiserv Part #</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="right">Unit Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.transaction_id}>
                    <TableCell>{dayjs(transaction.usage_date).format('MMM D, YYYY h:mm A')}</TableCell>
                    <TableCell>{transaction.part_name}</TableCell>
                    <TableCell>{transaction.fiserv_part_number}</TableCell>
                    <TableCell>{transaction.machine_name || '-'}</TableCell>
                    <TableCell align="center">
                      {getQuantityDisplay(transaction.quantity, transaction.reason)}
                    </TableCell>
                    <TableCell align="right">
                      {typeof transaction.unit_cost === 'number' ? `$${transaction.unit_cost.toFixed(2)}` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {startDate && endDate ? 'No transactions found' : 'Select a date range to view transactions'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Container>
    </LocalizationProvider>
  );
};

export default TransactionHistory;
