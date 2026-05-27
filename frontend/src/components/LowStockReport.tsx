// src/components/LowStockReport.tsx
import React, { useState, useEffect } from 'react';
import { Part } from '../types';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import * as XLSX from 'xlsx';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  TableSortLabel,
} from '@mui/material';
import {
  COLOR_ERROR_BG,
  COLOR_ERROR_TEXT,
  COLOR_WARNING_BG,
  COLOR_WARNING_TEXT,
  COLOR_SUCCESS_BG,
  COLOR_SUCCESS_TEXT,
  PRIMARY_ORANGE,
} from '../theme';

interface LowStockReportProps {
  data: Part[];
  exportRef?: React.MutableRefObject<(() => void) | null>;
}

interface PartOrderStatus {
  part_id: string;
  order_status: 'pending' | 'submitted' | 'approved' | 'received' | 'canceled' | 'none';
  po_id?: number;
}

// Order status colors map
const ORDER_STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  none:      { bg: '#f8f9fa', color: '#6c757d', border: '#dee2e6' },
  pending:   { bg: '#fff8e1', color: '#f57c00', border: '#ffb74d' },
  submitted: { bg: '#e3f2fd', color: '#1976d2', border: '#64b5f6' },
  on_order:  { bg: '#f3e5f5', color: '#7b1fa2', border: '#ba68c8' },
  approved:  { bg: '#e8f5e8', color: '#2e7d32', border: '#81c784' },
  received:  { bg: '#e0f2f1', color: '#00695c', border: '#4db6ac' },
  canceled:  { bg: '#ffebee', color: '#d32f2f', border: '#ef5350' },
  cancelled: { bg: '#ffebee', color: '#d32f2f', border: '#ef5350' },
};

const LowStockReport: React.FC<LowStockReportProps> = ({ data = [], exportRef }) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Part | 'stockStatus' | 'location' | 'orderStatus';
    direction: 'ascending' | 'descending';
  } | null>(null);
  const [partOrderStatuses, setPartOrderStatuses] = useState<PartOrderStatus[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const navigate = useNavigate();

  // Expose the export function to parent component
  useEffect(() => {
    if (exportRef) {
      exportRef.current = handleExportToExcel;
    }
  }, [exportRef, data, partOrderStatuses]);

  useEffect(() => {
    const fetchPartOrderStatuses = async () => {
      if (data.length === 0) return;

      try {
        const partIds = data.map((part: Part) => part.part_id);
        const response = await axiosInstance.get('/api/v1/parts/order-status', {
          params: { partIds: partIds.join(',') }
        });

        if (response.data && Array.isArray(response.data)) {
          setPartOrderStatuses(response.data);
        } else {
          setPartOrderStatuses([]);
        }
      } catch (error) {
        console.error('Error fetching part order statuses:', error);
        setPartOrderStatuses([]);
      }
    };

    fetchPartOrderStatuses();
  }, [data]);

  if (!data) {
    return <Typography color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>No data available</Typography>;
  }

  const getStockStatus = (part: Part): { label: string; bg: string; color: string } => {
    if (part.stock_status === 'out_of_stock') {
      return { label: 'Out of Stock', bg: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT };
    }
    if (part.stock_status === 'low_stock') {
      return { label: 'Low Stock', bg: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT };
    }
    return { label: 'In Stock', bg: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT };
  };

  const getOrderStatus = (partId: number | string): PartOrderStatus => {
    const status = partOrderStatuses.find(s => s.part_id === partId.toString());
    return status || { part_id: partId.toString(), order_status: 'none' };
  };

  const sortData = (data: Part[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      if (sortConfig.key === 'stockStatus') {
        const aStatus = getStockStatus(a).label;
        const bStatus = getStockStatus(b).label;
        return sortConfig.direction === 'ascending'
          ? aStatus.localeCompare(bStatus)
          : bStatus.localeCompare(aStatus);
      }

      if (sortConfig.key === 'location') {
        const aLocation = a.location || a.machine_name || 'N/A';
        const bLocation = b.location || b.machine_name || 'N/A';
        return sortConfig.direction === 'ascending'
          ? aLocation.localeCompare(bLocation)
          : bLocation.localeCompare(aLocation);
      }

      if (sortConfig.key === 'orderStatus') {
        const aOrderStatus = getOrderStatus(a.part_id.toString()).order_status;
        const bOrderStatus = getOrderStatus(b.part_id.toString()).order_status;
        return sortConfig.direction === 'ascending'
          ? aOrderStatus.localeCompare(bOrderStatus)
          : bOrderStatus.localeCompare(aOrderStatus);
      }

      if (sortConfig.key in a && sortConfig.key in b) {
        const aValue = a[sortConfig.key as keyof Part];
        const bValue = b[sortConfig.key as keyof Part];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending'
            ? aValue - bValue
            : bValue - aValue;
        }
      }

      return 0;
    });
  };

  const requestSort = (key: keyof Part | 'stockStatus' | 'location' | 'orderStatus') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedParts = sortData(data);

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);

      // Transform data for export
      const exportData = data.map((part) => {
        const status = getStockStatus(part);
        const orderStatus = getOrderStatus(part.part_id.toString());

        return {
          'Part Name': part.name,
          'Manufacturer Part #': part.manufacturer_part_number || 'N/A',
          'Location': part.location || part.machine_name || 'N/A',
          'Current Quantity': part.quantity,
          'Minimum Quantity': part.minimum_quantity,
          'Stock Status': status.label,
          'Order Status': orderStatus.order_status !== 'none' ? orderStatus.order_status.toUpperCase() : 'No orders',
          'Description': part.description || 'N/A',
          'Last Updated': part.updated_at ? new Date(part.updated_at).toLocaleDateString() : 'N/A'
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Part Name
        { wch: 20 }, // Manufacturer Part #
        { wch: 15 }, // Location
        { wch: 12 }, // Current Quantity
        { wch: 12 }, // Minimum Quantity
        { wch: 15 }, // Stock Status
        { wch: 15 }, // Order Status
        { wch: 35 }, // Description
        { wch: 15 }  // Last Updated
      ];
      worksheet['!cols'] = columnWidths;

      // Style the header row
      const range = XLSX.utils.decode_range(worksheet['!ref']!);
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF6200' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };

      // Apply header style to first row
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellRef]) continue;
        worksheet[cellRef].s = headerStyle;
      }

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Status');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `inventory_status_alerts_${timestamp}.xlsx`;

      // Export file
      XLSX.writeFile(workbook, filename);
      console.log('Inventory status exported successfully!');
    } catch (error: any) {
      console.error('Error exporting inventory status:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const handlePartClick = (partId: number | string) => {
    // Find the part to get its manufacturer part number for exact searching
    const part = data.find(p => p.part_id === partId);
    if (part) {
      // Use manufacturer part number for exact match, fall back to name if not available
      const searchTerm = part.manufacturer_part_number || part.name;
      navigate(`/parts?search=${encodeURIComponent(searchTerm)}`);
    } else {
      // Fallback to general parts page
      navigate('/parts');
    }
  };

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>
                <TableSortLabel
                  active={sortConfig?.key === 'name'}
                  direction={sortConfig?.key === 'name' ? (sortConfig.direction === 'ascending' ? 'asc' : 'desc') : 'asc'}
                  onClick={() => requestSort('name')}
                >
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                    Part Name
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig?.key === 'stockStatus'}
                  direction={sortConfig?.key === 'stockStatus' ? (sortConfig.direction === 'ascending' ? 'asc' : 'desc') : 'asc'}
                  onClick={() => requestSort('stockStatus')}
                >
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                    Status
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig?.key === 'orderStatus'}
                  direction={sortConfig?.key === 'orderStatus' ? (sortConfig.direction === 'ascending' ? 'asc' : 'desc') : 'asc'}
                  onClick={() => requestSort('orderStatus')}
                >
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                    Order Status
                  </Typography>
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedParts.length > 0 ? (
              sortedParts.map((part) => {
                const status = getStockStatus(part);
                const orderStatus = getOrderStatus(part.part_id.toString());
                const orderStyle = ORDER_STATUS_STYLES[orderStatus.order_status] || ORDER_STATUS_STYLES.none;

                return (
                  <TableRow key={part.part_id} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: PRIMARY_ORANGE,
                          cursor: 'pointer',
                          fontWeight: 500,
                          '&:hover': {
                            color: '#e55a00',
                            textDecoration: 'underline',
                          },
                        }}
                        onClick={() => handlePartClick(part.part_id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handlePartClick(part.part_id);
                          }
                        }}
                      >
                        {part.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={status.label}
                        size="small"
                        sx={{ bgcolor: status.bg, color: status.color, fontWeight: 500, textTransform: 'uppercase', fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={orderStatus.order_status !== 'none' ? orderStatus.order_status.toUpperCase() : 'No orders'}
                        size="small"
                        sx={{
                          bgcolor: orderStyle.bg,
                          color: orderStyle.color,
                          border: `1px solid ${orderStyle.border}`,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          letterSpacing: 0.5,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No low stock or out of stock parts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default LowStockReport;
