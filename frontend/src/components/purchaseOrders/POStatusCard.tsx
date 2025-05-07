import React from 'react';
import { Card, Table, Chip, Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface PurchaseOrder {
  po_id: number;
  po_number: string;
  status: string;
  supplier_name: string;
  total_amount: number;
  created_at: string;
}

interface POStatusCardProps {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
  recentPOs: PurchaseOrder[];
}

const POStatusCard: React.FC<POStatusCardProps> = ({ 
  pendingCount,
  approvedCount,
  rejectedCount,
  totalCount,
  recentPOs
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'submitted':
        return 'info';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'received':
        return 'success';
      case 'canceled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%', p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ color: '#FF6200' }}>Purchase Order Status</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/purchase-orders')}
          style={{ backgroundColor: '#0066A1' }}
        >
          View All
        </Button>
      </Box>
      
      {/* Status count cards removed as requested */}

      {recentPOs.length > 0 ? (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>Recent Purchase Orders</Typography>
          <Table size="small">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentPOs.map((po) => (
                <tr key={po.po_id} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/purchase-orders/detail/${po.po_id}`)}
                >
                  <td>{po.po_number}</td>
                  <td>{po.supplier_name || 'N/A'}</td>
                  <td>
                    <Chip 
                      label={po.status || 'pending'} 
                      color={getStatusColor(po.status) as any}
                      size="small"
                    />
                  </td>
                  <td>
                    ${typeof po.total_amount === 'number' ? 
                      po.total_amount.toFixed(2) : 
                      Number(po.total_amount || 0).toFixed(2)}
                  </td>
                  <td>
                    {po.created_at ? format(new Date(po.created_at), 'MM/dd/yyyy') : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No recent purchase orders
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default POStatusCard; 