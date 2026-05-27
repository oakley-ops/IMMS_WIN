'use client';
import React from 'react';
import {
  Box, Typography, Paper, Grid, Stack, Alert, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import type { PartsMetrics } from '../../services/maintenanceCallService';
import { MCS_ORANGE, STATUS_OPEN, STATUS_IN_PROGRESS } from '../../theme';

interface Props {
  partsMetrics: PartsMetrics | null;
  loading: boolean;
  error: string | null;
}

function HBar({ primaryLabel, secondaryLabel, value, max, color, suffix }: {
  primaryLabel: string;
  secondaryLabel?: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '65%' }}>
          <span>{primaryLabel}</span>
          {secondaryLabel && (
            <Typography component="span" variant="body2" color="text.secondary">
              {secondaryLabel}
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">{value}{suffix || ''}</Typography>
      </Stack>
      <Box sx={{ height: 10, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  );
}

export default function PartsConsumptionSection({ partsMetrics, loading, error }: Props) {
  const topMax = Math.max(0, ...(partsMetrics?.top_parts.map(p => p.total_qty) ?? []));
  const machMax = Math.max(0, ...(partsMetrics?.by_machine.map(m => m.total_qty) ?? []));

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress size={40} sx={{ color: MCS_ORANGE }} />
        </Box>
      ) : (
        <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Panel A — Top Parts by Quantity */}
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Top Parts by Quantity Used</Typography>
            {!partsMetrics || partsMetrics.top_parts.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No data</Typography>
            ) : (
              partsMetrics.top_parts.map(p => (
                <HBar
                  key={p.part_id}
                  primaryLabel={p.part_name}
                  secondaryLabel={
                    `${p.part_number ? ` (${p.part_number})` : ''}  · ${p.call_count} call${p.call_count !== 1 ? 's' : ''}`
                  }
                  value={p.total_qty}
                  max={topMax}
                  color={STATUS_OPEN}
                  suffix=" units"
                />
              ))
            )}
          </Paper>
        </Grid>

        {/* Panel B — Top Machines by Parts Used */}
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Top Machines by Parts Used</Typography>
            {!partsMetrics || partsMetrics.by_machine.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No data</Typography>
            ) : (
              partsMetrics.by_machine.map(m => (
                <HBar
                  key={m.machine_id}
                  primaryLabel={m.machine_name}
                  secondaryLabel={`  (${m.unique_parts} unique)`}
                  value={m.total_qty}
                  max={machMax}
                  color={STATUS_IN_PROGRESS}
                  suffix=" units"
                />
              ))
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Panel C — Parts Usage by Technician */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Parts Usage by Technician</Typography>
        {!partsMetrics || partsMetrics.by_tech.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No data</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Technician</strong></TableCell>
                <TableCell align="right"><strong>Calls w/ Parts</strong></TableCell>
                <TableCell align="right"><strong>Unique Parts</strong></TableCell>
                <TableCell align="right"><strong>Total Qty</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {partsMetrics.by_tech.map((t, i) => (
                <TableRow key={`${t.technician_id ?? 'na'}-${i}`} hover>
                  <TableCell>{t.technician_name || '—'}</TableCell>
                  <TableCell align="right">{t.calls_with_parts}</TableCell>
                  <TableCell align="right">{t.unique_parts}</TableCell>
                  <TableCell align="right">{t.total_qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
        </>
      )}
    </Box>
  );
}
