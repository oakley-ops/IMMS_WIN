// src/components/LowStockReport.tsx
import React, { useState, useEffect } from 'react';
import './LowStockReport.css';
import { Part } from '../types';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';

interface LowStockReportProps {
  data: Part[];
}

interface PartOrderStatus {
  part_id: string;
  order_status: 'pending' | 'submitted' | 'approved' | 'received' | 'canceled' | 'none';
  po_id?: number;
}

const LowStockReport: React.FC<LowStockReportProps> = ({ data = [] }) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Part | 'stockStatus' | 'location' | 'orderStatus';
    direction: 'ascending' | 'descending';
  } | null>(null);
  const [partOrderStatuses, setPartOrderStatuses] = useState<PartOrderStatus[]>([]);
  const navigate = useNavigate();

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
                    <td>{part.name}</td>
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
                        <span className="text-muted">No orders</span>
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