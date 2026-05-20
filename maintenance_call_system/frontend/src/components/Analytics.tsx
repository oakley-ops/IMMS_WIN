'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
  TextField, MenuItem, Stack, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Button, Alert,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import svc, { CallMetrics, MetricsFilters, ReasonCategory } from '../services/maintenanceCallService';
import {
  MCS_ORANGE, STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_RESOLVED,
  STATUS_SUSPENDED, STATUS_CRITICAL,
} from '../theme';

type ReasonMeta = { value: ReasonCategory; label: string; color: string };

const REASONS: ReasonMeta[] = [
  { value: 'mechanical',     label: 'Mechanical',    color: STATUS_OPEN },
  { value: 'electrical',     label: 'Electrical',    color: STATUS_IN_PROGRESS },
  { value: 'tooling',        label: 'Tooling',       color: '#42A5F5' },
  { value: 'material',       label: 'Material',      color: STATUS_SUSPENDED },
  { value: 'operator_error', label: 'Operator Err.', color: STATUS_RESOLVED },
  { value: 'other',          label: 'Other',         color: '#9E9E9E' },
];

const SHIFTS = ['1st Shift', '2nd Shift', '3rd Shift'];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: string | number | null | undefined, digits = 1): string => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const fmtMoney = (v: string | number | null | undefined): string => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const reasonLabel = (k: string | null): string =>
  REASONS.find(r => r.value === k)?.label || k || 'Unknown';

const reasonColor = (k: string | null): string =>
  REASONS.find(r => r.value === k)?.color || '#9E9E9E';

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card sx={{ borderTop: `3px solid ${accent || MCS_ORANGE}` }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function HBar({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '60%' }}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {fmt(value)}{suffix || ''}
        </Typography>
      </Stack>
      <Box sx={{ height: 10, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  );
}

export default function Analytics() {
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(ymd(daysAgo(30)));
  const [to, setTo] = useState(ymd(new Date()));
  const [shift, setShift] = useState('');
  const [reason, setReason] = useState<'' | ReasonCategory>('');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: MetricsFilters = {
        from: from || undefined,
        to: to || undefined,
        shift_name: shift || undefined,
        reason: reason || undefined,
      };
      setMetrics(await svc.getMetrics(filters));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [from, to, shift, reason]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const machineMax = useMemo(
    () => Math.max(0, ...((metrics?.by_machine || []).map(m => num(m.total_downtime_hours)))),
    [metrics]
  );
  const reasonMax = useMemo(
    () => Math.max(0, ...((metrics?.by_reason || []).map(r => num(r.count)))),
    [metrics]
  );
  const shiftMax = useMemo(
    () => Math.max(0, ...((metrics?.by_shift || []).map(s => num(s.call_count)))),
    [metrics]
  );
  const trendMax = useMemo(
    () => Math.max(
      0,
      ...((metrics?.trend_weekly || []).flatMap(t => [num(t.avg_mtta_minutes), num(t.avg_mttr_minutes)]))
    ),
    [metrics]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>Maintenance Analytics</Typography>
        <Button
          startIcon={<Refresh />}
          onClick={fetchMetrics}
          disabled={loading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="From" type="date" size="small"
            value={from} onChange={e => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To" type="date" size="small"
            value={to} onChange={e => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Shift" select size="small"
            value={shift} onChange={e => setShift(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All shifts</MenuItem>
            {SHIFTS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            label="Reason" select size="small"
            value={reason} onChange={e => setReason(e.target.value as any)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All reasons</MenuItem>
            {REASONS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading && !metrics ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress sx={{ color: MCS_ORANGE }} />
        </Box>
      ) : !metrics ? null : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Open Calls"
                value={fmt(metrics.overall.open_calls, 0)}
                accent={STATUS_OPEN}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Total Calls"
                value={fmt(metrics.overall.total_calls, 0)}
                sub="resolved in range"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="MTTA"
                value={`${fmt(metrics.overall.avg_response_minutes)} min`}
                sub="mean time to acknowledge"
                accent={STATUS_IN_PROGRESS}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="MTTR"
                value={`${fmt(metrics.overall.avg_repair_minutes)} min`}
                sub="mean time to repair"
                accent={STATUS_IN_PROGRESS}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Avg Downtime"
                value={`${fmt(metrics.overall.avg_downtime_minutes)} min`}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Total Downtime"
                value={`${fmt(metrics.overall.total_downtime_hours)} hr`}
                accent={STATUS_OPEN}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="SLA %"
                value={metrics.overall.sla_pct == null ? '—' : `${fmt(metrics.overall.sla_pct)}%`}
                sub="acknowledged ≤ 10 min"
                accent={STATUS_RESOLVED}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Downtime Cost"
                value={fmtMoney(metrics.overall.total_downtime_cost)}
                accent={STATUS_CRITICAL}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Top Machines by Downtime</Typography>
                {(metrics.by_machine || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  metrics.by_machine.map(m => (
                    <HBar
                      key={m.machine_id}
                      label={`${m.machine_name || `#${m.machine_id}`}  (${fmt(m.call_count, 0)} calls)`}
                      value={num(m.total_downtime_hours)}
                      max={machineMax}
                      color={STATUS_OPEN}
                      suffix=" hr"
                    />
                  ))
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Failure Reasons</Typography>
                {(metrics.by_reason || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  metrics.by_reason.map(r => (
                    <HBar
                      key={r.reason_category || 'unknown'}
                      label={reasonLabel(r.reason_category)}
                      value={num(r.count)}
                      max={reasonMax}
                      color={reasonColor(r.reason_category)}
                    />
                  ))
                )}
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Weekly Trend</Typography>
                {(metrics.trend_weekly || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Week of</TableCell>
                        <TableCell align="right">Calls</TableCell>
                        <TableCell align="right">MTTA (min)</TableCell>
                        <TableCell align="right">MTTR (min)</TableCell>
                        <TableCell>MTTA vs MTTR</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.trend_weekly.map(t => {
                        const mtta = num(t.avg_mtta_minutes);
                        const mttr = num(t.avg_mttr_minutes);
                        const mttaPct = trendMax > 0 ? (mtta / trendMax) * 100 : 0;
                        const mttrPct = trendMax > 0 ? (mttr / trendMax) * 100 : 0;
                        return (
                          <TableRow key={t.week_start}>
                            <TableCell>{new Date(t.week_start).toLocaleDateString()}</TableCell>
                            <TableCell align="right">{fmt(t.call_count, 0)}</TableCell>
                            <TableCell align="right">{fmt(t.avg_mtta_minutes)}</TableCell>
                            <TableCell align="right">{fmt(t.avg_mttr_minutes)}</TableCell>
                            <TableCell sx={{ width: 200 }}>
                              <Stack spacing={0.3}>
                                <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 0.5, overflow: 'hidden' }}>
                                  <Box sx={{ width: `${mttaPct}%`, height: '100%', bgcolor: STATUS_IN_PROGRESS }} />
                                </Box>
                                <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 0.5, overflow: 'hidden' }}>
                                  <Box sx={{ width: `${mttrPct}%`, height: '100%', bgcolor: STATUS_OPEN }} />
                                </Box>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>By Shift</Typography>
                {(metrics.by_shift || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  metrics.by_shift.map(s => (
                    <HBar
                      key={s.shift_name || 'Unknown'}
                      label={`${s.shift_name || 'Unknown'}  (avg ${fmt(s.avg_downtime_minutes)} min)`}
                      value={num(s.call_count)}
                      max={shiftMax}
                      color={MCS_ORANGE}
                      suffix=" calls"
                    />
                  ))
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Technician Workload</Typography>
            {(metrics.by_tech || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No data</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Technician</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Avg Response (min)</TableCell>
                    <TableCell align="right">Avg Repair (min)</TableCell>
                    <TableCell align="right">SLA %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.by_tech.map((t, i) => (
                    <TableRow key={`${t.technician_id ?? 'na'}-${i}`}>
                      <TableCell>{t.technician_name || '—'}</TableCell>
                      <TableCell align="right">{fmt(t.call_count, 0)}</TableCell>
                      <TableCell align="right">{fmt(t.avg_response_minutes)}</TableCell>
                      <TableCell align="right">{fmt(t.avg_repair_minutes)}</TableCell>
                      <TableCell align="right">
                        {t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Repeat Failures (3+ in range)</Typography>
            {(metrics.repeat_failures || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No machine + reason combos with 3 or more occurrences
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Machine</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Occurrences</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.repeat_failures.map((r, i) => (
                    <TableRow key={`${r.machine_id}-${r.reason_category}-${i}`}>
                      <TableCell>{r.machine_name || `#${r.machine_id}`}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={reasonLabel(r.reason_category)}
                          sx={{ bgcolor: reasonColor(r.reason_category), color: 'white' }}
                        />
                      </TableCell>
                      <TableCell align="right">{fmt(r.occurrences, 0)}</TableCell>
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
