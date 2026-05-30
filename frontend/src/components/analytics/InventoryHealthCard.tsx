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
import { InventoryHealth } from '../../services/analyticsService';

interface InventoryHealthCardProps {
  data: InventoryHealth;
}

const InventoryHealthCard: React.FC<InventoryHealthCardProps> = ({ data }) => {
  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Inventory Health
        </Typography>

        <Box display="flex" justifyContent="space-between" sx={{ mb: 3, mt: 1 }}>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Turnover Rate
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {data.average_turnover_rate.toFixed(2)}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Stock Coverage
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {data.stock_coverage_days} days
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
          High Risk Parts
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Part Name</TableCell>
                <TableCell>Risk Score</TableCell>
                <TableCell>Days to Stockout</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.high_risk_parts.map(part => (
                <TableRow key={part.part_id}>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{(part.risk_score * 100).toFixed(1)}%</TableCell>
                  <TableCell>{part.days_until_stockout.toFixed(1)} days</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default InventoryHealthCard;
