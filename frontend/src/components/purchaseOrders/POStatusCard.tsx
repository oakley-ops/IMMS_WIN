import React from 'react';
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  Typography,
  Button
} from '@mui/material';
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
      case 'waiting_for_po_number':
        return 'secondary';
      case 'on_hold':
        return 'secondary';
      case 'rejected':
        return 'error';
      case 'received':
        return 'success';
      case 'on_order':
        return 'info';
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
          color="primary"
          onClick={() => navigate('/purchase-orders')}
        >
          View All
        </Button>
      </Box>

      {recentPOs.length > 0 ? (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>Recent Purchase Orders</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentPOs.map((po) => (
                  <TableRow
                    key={po.po_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/purchase-orders/detail/${po.po_id}`)}
                  >
                    <TableCell>{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={po.status || 'pending'}
                        color={getStatusColor(po.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      ${typeof po.total_amount === 'number' ?
                        po.total_amount.toFixed(2) :
                        Number(po.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {po.created_at ? format(new Date(po.created_at), 'MM/dd/yyyy') : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
