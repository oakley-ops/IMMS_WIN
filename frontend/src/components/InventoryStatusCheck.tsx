import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Divider,
} from '@mui/material';
import axios from 'axios';

interface InventoryStatus {
  diagnosticRun: string;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockParts: any[];
  outOfStockParts: any[];
  message: string;
}

const InventoryStatusCheck: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InventoryStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create a direct request to the active port (4000) with authentication
      const token = localStorage.getItem('token');
      const result = await axios.get('http://localhost:4000/api/v1/parts/low-stock', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      console.log('Low stock parts:', result.data);

      // Format the response to match our expected structure
      const formattedResult = {
        diagnosticRun: new Date().toISOString(),
        lowStockCount: result.data.length,
        outOfStockCount: result.data.filter((part: any) => part.quantity === 0).length,
        lowStockParts: result.data.filter((part: any) => part.quantity > 0),
        outOfStockParts: result.data.filter((part: any) => part.quantity === 0),
        message: result.data.length > 0
          ? 'Retrieved inventory status data successfully.'
          : 'No low stock or out of stock parts found.'
      };

      setStatus(formattedResult);
    } catch (err: any) {
      console.error('Error checking inventory status:', err);
      setError(err.message || 'Failed to check inventory status');
    } finally {
      setLoading(false);
    }
  };

  const updateParts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Example: Update a few parts to have low stock
      const partsToUpdate = [
        { id: '1', quantity: 1, minimum_quantity: 5 },
        { id: '2', quantity: 0, minimum_quantity: 3 },
        { id: '3', quantity: 2, minimum_quantity: 10 }
      ];

      for (const part of partsToUpdate) {
        try {
          await axios.put(`http://localhost:4000/api/v1/parts/${part.id}`, {
            quantity: part.quantity,
            minimum_quantity: part.minimum_quantity
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
            }
          });
          console.log(`Updated part ${part.id} to quantity=${part.quantity}, min=${part.minimum_quantity}`);
        } catch (updateErr) {
          console.error(`Error updating part ${part.id}:`, updateErr);
        }
      }

      // Re-check status
      await checkStatus();
    } catch (err: any) {
      console.error('Error updating parts:', err);
      setError(err.message || 'Failed to update parts');
    } finally {
      setLoading(false);
    }
  };

  const StockTable = ({ parts, title }: { parts: any[]; title: string }) => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Minimum</TableCell>
              <TableCell>Vendor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parts.map(part => (
              <TableRow key={part.part_id}>
                <TableCell>{part.part_id}</TableCell>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.quantity}</TableCell>
                <TableCell>{part.minimum_quantity}</TableCell>
                <TableCell>{part.vendor_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Inventory Status Diagnostic
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              color="primary"
              onClick={checkStatus}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              {loading ? 'Checking...' : 'Check Status'}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={updateParts}
              disabled={loading}
            >
              Set Test Low Stock
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {status && (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Diagnostic Run:</strong> {new Date(status.diagnosticRun).toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }} color="warning.main">
                  <strong>Low Stock Count:</strong> {status.lowStockCount}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }} color="error.main">
                  <strong>Out of Stock Count:</strong> {status.outOfStockCount}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </Box>

            <Alert severity={status.lowStockCount > 0 || status.outOfStockCount > 0 ? 'info' : 'success'}>
              {status.message}
            </Alert>

            <Collapse in={showDetails}>
              {status.lowStockParts.length > 0 && (
                <StockTable parts={status.lowStockParts} title="Low Stock Parts" />
              )}
              {status.outOfStockParts.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <StockTable parts={status.outOfStockParts} title="Out of Stock Parts" />
                </>
              )}
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryStatusCheck;
