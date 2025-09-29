// src/components/LowStockReport.tsx
import React, { useState, useEffect } from 'react';
import './LowStockReport.css';
import { Part } from '../types';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import * as XLSX from 'xlsx';

interface LowStockReportProps {
  data: Part[];
  exportRef?: React.MutableRefObject<(() => void) | null>;
}

interface PartOrderStatus {
  part_id: string;
  order_status: 'pending' | 'submitted' | 'approved' | 'received' | 'canceled' | 'none';
  po_id?: number;
}

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
    return <div className="empty-state">No data available</div>;
  }

  const getStockStatus = (part: Part): { label: string; className: string } => {
    if (part.stock_status === 'out_of_stock') {
      return { label: 'Out of Stock', className: 'out-of-stock' };
    }
    if (part.stock_status === 'low_stock') {
      return { label: 'Low Stock', className: 'low-stock' };
    }
    return { label: 'In Stock', className: 'in-stock' };
  };

  const getOrderStatus = (partId: number | string): PartOrderStatus => {
    const status = partOrderStatuses.find(s => s.part_id === partId.toString());
    return status || { part_id: partId.toString(), order_status: 'none' };
  };

  const getStatusLabel = (status: string): string => {
    return status.toUpperCase();
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
          'CRC Part #': part.crc_part_number || 'N/A',
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
        { wch: 20 }, // CRC Part #
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
      const searchTerm = part.manufacturer_part_number || part.crc_part_number || part.name;
      navigate(`/parts?search=${encodeURIComponent(searchTerm)}`);
    } else {
      // Fallback to general parts page
      navigate('/parts');
    }
  };

  return (
    <div className="low-stock-report">
      <div className="table-responsive">
        <table className="low-stock-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('name')}>Part Name</th>
              <th onClick={() => requestSort('stockStatus')}>Status</th>
              <th onClick={() => requestSort('orderStatus')}>Order Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedParts.length > 0 ? (
              sortedParts.map((part) => {
                const status = getStockStatus(part);
                const orderStatus = getOrderStatus(part.part_id.toString());
                
                return (
                  <tr key={part.part_id}>
                    <td>
                      <span 
                        className="part-name-link"
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
                      </span>
                    </td>
                    <td>
                      <span className={`status-chip ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {orderStatus.order_status !== 'none' ? (
                        <span className={`order-status-chip ${orderStatus.order_status}`}>
                          {getStatusLabel(orderStatus.order_status)}
                        </span>
                      ) : (
                        <span className="order-status-chip no-orders">
                          No orders
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="empty-state">
                  No low stock or out of stock parts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LowStockReport;