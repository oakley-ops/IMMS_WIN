import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { suppliersApi, partsApi } from '../../services/api';
import { Part, Supplier, PartSupplier } from '../../types/purchaseOrder';

interface SupplierPartWithDetails extends Part {
  supplier_unit_cost: number;
  is_preferred: boolean;
  lead_time_days: number;
  minimum_order_quantity: number;
}

const SupplierPartsList: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [parts, setParts] = useState<SupplierPartWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    const fetchSupplierAndParts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get supplier details
        const supplierResponse = await suppliersApi.getById(parseInt(id));
        setSupplier(supplierResponse.data);
        
        // Get parts by supplier
        const partsResponse = await suppliersApi.getPartsBySupplier(parseInt(id));
        setParts(partsResponse.data || []);
      } catch (error) {
        console.error('Error fetching supplier parts:', error);
        setError('Failed to load supplier data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSupplierAndParts();
  }, [id]);

  const getStatusColor = (quantity: number, minimumQuantity: number) => {
    if (quantity <= 0) return 'error';
    if (quantity <= minimumQuantity) return 'warning';
    return 'success';
  };

  const getStatusLabel = (quantity: number, minimumQuantity: number) => {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity <= minimumQuantity) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          {supplier ? `Parts from ${supplier.name}` : 'Supplier Parts'}
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/purchase-orders/suppliers')}
          variant="outlined"
        >
          Back to Suppliers
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {supplier && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Supplier Information</Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            <Box flex="1" minWidth="200px">
              <Typography variant="subtitle2" color="text.secondary">Name</Typography>
              <Typography variant="body1">{supplier.name}</Typography>
            </Box>
            <Box flex="1" minWidth="200px">
              <Typography variant="subtitle2" color="text.secondary">Contact</Typography>
              <Typography variant="body1">{supplier.contact_name || 'N/A'}</Typography>
            </Box>
            <Box flex="1" minWidth="200px">
              <Typography variant="subtitle2" color="text.secondary">Email</Typography>
              <Typography variant="body1">{supplier.email || 'N/A'}</Typography>
            </Box>
            <Box flex="1" minWidth="200px">
              <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
              <Typography variant="body1">{supplier.phone || 'N/A'}</Typography>
            </Box>
          </Box>
          {supplier.address && (
            <Box mt={2}>
              <Typography variant="subtitle2" color="text.secondary">Address</Typography>
              <Typography variant="body1">{supplier.address}</Typography>
            </Box>
          )}
        </Paper>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={5}>
          <CircularProgress />
        </Box>
      ) : parts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No parts found for this supplier.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Part Name</TableCell>
                <TableCell>Part Number</TableCell>
                <TableCell align="right">Unit Cost</TableCell>
                <TableCell align="right">Quantity in Stock</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lead Time (Days)</TableCell>
                <TableCell align="right">Min. Order Qty</TableCell>
                <TableCell>Preferred</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parts.map((part) => (
                <TableRow key={part.part_id}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate(`/parts/${part.part_id}`)}
                    >
                      {part.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {part.fiserv_part_number || part.manufacturer_part_number || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    ${part.supplier_unit_cost.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">{part.quantity}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={getStatusLabel(part.quantity, part.minimum_quantity)}
                      color={getStatusColor(part.quantity, part.minimum_quantity)}
                    />
                  </TableCell>
                  <TableCell align="right">{part.lead_time_days || 'N/A'}</TableCell>
                  <TableCell align="right">{part.minimum_order_quantity || 1}</TableCell>
                  <TableCell>
                    {part.is_preferred ? (
                      <Chip size="small" label="Preferred" color="primary" />
                    ) : 'No'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
};

export default SupplierPartsList;
