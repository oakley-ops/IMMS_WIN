import React, { useEffect, useState, useCallback } from 'react';
import { PRIMARY_ORANGE } from '../theme';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Grid,
  Chip,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import ExcelJS from 'exceljs';
import axios from 'axios';
import DataTable, { ColumnDef } from '../components/DataTable';

interface Transaction {
  transaction_id: number;
  part_id: number;
  part_name: string;
  manufacturer_part_number: string;
  machine_name: string;
  type: string;
  quantity: number;
  date: string;
  user_id: string;
  notes: string;
  reference_number: string;
  unit_cost: number;
}

type TxRow = Transaction & { id: number };

// Custom CSS styles for IMMS branding
const ImmsStyles = `
  .text-primary {
    color: ${PRIMARY_ORANGE} !important;
  }

  .bg-primary {
    background-color: #0066A1 !important;
  }

  .form-check-input:checked {
    background-color: ${PRIMARY_ORANGE};
    border-color: ${PRIMARY_ORANGE};
  }

  .border-primary {
    border-color: ${PRIMARY_ORANGE} !important;
  }

  a {
    color: ${PRIMARY_ORANGE};
  }

  a:hover {
    color: #e65c00;
  }
`;

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const fetchTransactions = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (start) params.append('startDate', `${start}T00:00:00`);
      if (end) params.append('endDate', `${end}T23:59:59`);

      const url = `/api/v1/transactions?${params.toString()}`;
      console.log('Fetching transactions from URL:', url);
      console.log('Date params:', { start, end });

      const response = await axios.get<Transaction[]>(url);
      console.log('Transactions response:', response.data.length, 'transactions');
      setTransactions(response.data);
      setFilteredTransactions(response.data);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect for filtering transactions based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredTransactions(transactions);
    } else {
      const filtered = transactions.filter(transaction =>
        transaction.part_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.manufacturer_part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.machine_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTransactions(filtered);
    }
  }, [transactions, searchTerm]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-filter when dates change
  useEffect(() => {
    if (startDate || endDate) {
      fetchTransactions(startDate, endDate);
    } else if (startDate === '' && endDate === '') {
      // When both dates are cleared, load all transactions
      fetchTransactions();
    }
  }, [startDate, endDate, fetchTransactions]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Filter button clicked with dates:', { startDate, endDate });
    fetchTransactions(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    // fetchTransactions() will be called automatically by the useEffect when dates are cleared
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Use filtered transactions for export, but only show usage transactions
      const transactionsToExport = filteredTransactions.filter(transaction => transaction.type === 'usage');

      // Calculate summary data
      const totalItems = transactionsToExport.length;
      const totalCost = transactionsToExport.reduce((sum, transaction) => {
        return sum + (Number(transaction.unit_cost) || 0);
      }, 0);

      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Parts Usage History');

      // Set column widths
      worksheet.columns = [
        { width: 15 }, // Date
        { width: 35 }, // Part Name
        { width: 25 }, // Mfg Part #
        { width: 25 }, // Machine
        { width: 12 }, // Quantity
        { width: 15 }, // Unit Cost
      ];

      // Add title row
      const titleRow = worksheet.addRow(['Parts Usage History Report', '', '', '', '', '']);
      titleRow.height = 25;

      // Style title row
      worksheet.mergeCells('A1:F1');
      titleRow.getCell(1).font = { bold: true, size: 14 };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Add summary row
      const summaryRow = worksheet.addRow(['Summary', '', `Total Items: ${totalItems}`, '', `Total Cost: $${totalCost.toFixed(2)}`, '']);
      summaryRow.height = 20;

      // Style summary row
      worksheet.mergeCells('A2:B2');
      worksheet.mergeCells('E2:F2');
      summaryRow.getCell(1).font = { bold: true, size: 11 };
      summaryRow.getCell(4).font = { bold: true };
      summaryRow.getCell(6).font = { bold: true };
      summaryRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };
      summaryRow.getCell(3).alignment = { horizontal: 'center' };
      summaryRow.getCell(5).alignment = { horizontal: 'center' };

      // Add empty row
      worksheet.addRow([]);

      // Add header row
      const headerRow = worksheet.addRow(['Date', 'Part Name', 'Mfg Part #', 'Machine', 'Quantity', 'Unit Cost']);
      headerRow.height = 20;
      
      // Style header row
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add data rows
      transactionsToExport.forEach((transaction, index) => {
        const row = worksheet.addRow([
          formatDateShort(transaction.date),
          transaction.part_name,
          transaction.manufacturer_part_number || 'N/A',
          transaction.machine_name || 'N/A',
          transaction.quantity,
          Number(transaction.unit_cost) || 0
        ]);

        // Style data rows
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };

          // Alternate row colors
          if (index % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          }

          // Format currency column
          if (colNumber === 6) {
            cell.numFmt = '$#,##0.00';
          }

          // Center align quantity and cost
          if (colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: 'center' };
          }
        });
      });

      // Generate filename
      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      const filename = `Parts_Usage_History${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      setSuccess('Parts Usage History exported successfully!');
    } catch (error: any) {
      console.error('Error exporting transactions:', error);
      setError('Failed to export transactions');
    } finally {
      setExportLoading(false);
      setExportDialogOpen(false);
    }
  };

  // Define DataTable columns
  const columns: ColumnDef<TxRow>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (row) => formatDateShort(row.date),
    },
    { key: 'part_name', label: 'Part Name' },
    { key: 'manufacturer_part_number', label: 'Mfg Part #' },
    { key: 'machine_name', label: 'Machine' },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: (row) => (
        <Box component="span" sx={{
          fontWeight: 'bold',
          color: row.type === 'usage' ? '#f44336' :
                 row.type === 'return' ? '#2196f3' : '#4caf50'
        }}>
          {row.type === 'usage' ? '-' : '+'}
          {row.quantity}
          {row.type === 'return' && ' (Returned)'}
          {row.type === 'restock' && ' (Restocked)'}
          {row.type === 'usage' && ' (Used)'}
        </Box>
      ),
    },
    {
      key: 'unit_cost',
      label: 'Unit Cost',
      align: 'right',
      render: (row) => (
        <span>${Number(row.unit_cost || 0).toFixed(2)}</span>
      ),
    },
  ];

  return (
    <Container 
      maxWidth="xl" 
      sx={{ 
        backgroundColor: '#0066A1',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        backgroundImage: 'linear-gradient(135deg, rgba(0, 0, 0, 0.05) 25%, transparent 25%, transparent 50%, rgba(0, 0, 0, 0.05) 50%, rgba(0, 0, 0, 0.05) 75%, transparent 75%, transparent)',
        backgroundSize: '20px 20px'
      }}
    >
      {/* Apply IMMS brand styling */}
      <style>{ImmsStyles}</style>
      
      <Typography variant="h4" sx={{ color: PRIMARY_ORANGE, mb: 3, fontWeight: 'bold' }}>
        Parts Usage History
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {/* Search and Filters */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '0.75rem', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={3} alignItems="end">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search transactions by part name, part number, or machine..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '0.5rem' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                  },
                }}
              />
              {loading && searchTerm && (
                <LinearProgress sx={{ mt: 1, height: '2px', '& .MuiLinearProgress-bar': { backgroundColor: PRIMARY_ORANGE } }} />
              )}
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                  },
                }}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: PRIMARY_ORANGE,
                    },
                  },
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '100px'
                  }}
                >
              Reset
            </Button>
                <Button
                  variant="outlined"
                  onClick={handleExport}
                  disabled={exportLoading}
                  startIcon={exportLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  sx={{ 
                    borderColor: PRIMARY_ORANGE,
                    color: PRIMARY_ORANGE,
                    '&:hover': { 
                      borderColor: '#e65c00',
                      backgroundColor: 'rgba(255, 102, 0, 0.04)'
                    },
                    minWidth: '120px'
                  }}
                >
                  {exportLoading ? 'Exporting...' : 'Export'}
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Statistics row */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Chip 
              label={`${filteredTransactions.length} transactions showing`} 
              color="primary" 
              variant="outlined"
              sx={{ 
                borderColor: PRIMARY_ORANGE,
                color: PRIMARY_ORANGE,
                backgroundColor: 'rgba(255, 102, 0, 0.04)'
              }}
            />
            <Chip 
              label={`${transactions.length} total transactions`} 
              color="primary" 
              sx={{ 
                backgroundColor: PRIMARY_ORANGE,
                color: 'white'
              }}
            />
            {searchTerm && (
              <Chip 
                label={`Search: "${searchTerm}"`} 
                color="primary" 
                onDelete={() => setSearchTerm('')}
                sx={{ 
                  backgroundColor: '#0066A1',
                  color: 'white'
                }}
              />
            )}
            {(startDate || endDate) && (
              <Chip 
                label={`Date Filter: ${startDate || 'Start'} to ${endDate || 'End'}`} 
                color="primary" 
                onDelete={() => {
                  setStartDate('');
                  setEndDate('');
                  fetchTransactions();
                }}
                sx={{ 
                  backgroundColor: '#0066A1',
                  color: 'white'
                }}
              />
            )}
          </Box>
        </Paper>

        {/* Transactions Table */}
        <Paper 
          elevation={0} 
          sx={{ 
            width: '100%', 
            mb: 3, 
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            backgroundColor: 'white'
          }}
        >
          <Box sx={{ width: '100%', height: 650 }}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress sx={{ color: PRIMARY_ORANGE }} />
                <Typography variant="body1" sx={{ mt: 2 }}>Loading transactions...</Typography>
              </Box>
            ) : (
              <DataTable<TxRow>
                columns={columns}
                rows={filteredTransactions.map((t) => ({ ...t, id: t.transaction_id })) as TxRow[]}
                pageSize={25}
                emptyMessage="No transactions found"
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Success/Error Notifications */}
      {(!!error || !!success) && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1400,
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: 2,
              borderRadius: '0.75rem',
              backgroundColor: error ? '#f44336' : '#4caf50',
              color: 'white',
              minWidth: '300px',
              maxWidth: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2">
              {error || success}
            </Typography>
            <IconButton
              size="small"
              onClick={() => { setError(null); setSuccess(null); }}
              sx={{ color: 'white', ml: 1 }}
            >
              ✕
            </IconButton>
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default Transactions;
