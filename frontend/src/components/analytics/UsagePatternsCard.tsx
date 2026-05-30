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
import { UsagePatterns } from '../../services/analyticsService';

interface UsagePatternsCardProps {
  data: UsagePatterns;
}

const UsagePatternsCard: React.FC<UsagePatternsCardProps> = ({ data }) => {
  return (
    <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Usage Patterns
        </Typography>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
          Fastest Moving Parts
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Part Name</TableCell>
                <TableCell>Usage Trend</TableCell>
                <TableCell>Used (30d)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.fastest_moving_parts.map(part => (
                <TableRow key={part.part_id}>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{Math.abs(part.trend).toFixed(2)} units/day</TableCell>
                  <TableCell>{part.usage_last_30_days} units</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box textAlign="center" sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Usage chart visualization will be available soon
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UsagePatternsCard;
