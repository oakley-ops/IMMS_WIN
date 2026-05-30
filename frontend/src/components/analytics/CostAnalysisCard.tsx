import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { CostAnalysis } from '../../services/analyticsService';

interface CostAnalysisCardProps {
  data: CostAnalysis;
}

const CostAnalysisCard: React.FC<CostAnalysisCardProps> = ({ data }) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Cost Analysis
        </Typography>

        <Box display="flex" justifyContent="space-between" sx={{ mb: 3, mt: 1 }}>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Total Value
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCurrency(data.total_inventory_value)}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Avg Part Cost
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCurrency(data.average_part_cost)}
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
          Highest Value Parts
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Part Name</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Unit Cost</TableCell>
                <TableCell>Total Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.highest_value_parts.map(part => (
                <TableRow key={part.part_id}>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{part.quantity}</TableCell>
                  <TableCell>{formatCurrency(part.unit_cost)}</TableCell>
                  <TableCell>{formatCurrency(part.total_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default CostAnalysisCard;
