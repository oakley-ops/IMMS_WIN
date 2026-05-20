import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Divider
} from '@mui/material';
import { Engineering, Warning, CheckCircle } from '@mui/icons-material';
import io from 'socket.io-client';
import maintenanceCallService, { MaintenanceCall } from '../services/maintenanceCallService';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

function elapsed(from: string): string {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function CallCard({ call, now }: { call: MaintenanceCall; now: number }) {
  const isOpen = call.status === 'open';
  const isInProgress = call.status === 'in_progress';

  const borderColor = isOpen ? '#f44336' : isInProgress ? '#ff9800' : '#4caf50';
  const bgColor = isOpen ? '#fff5f5' : isInProgress ? '#fff8f0' : '#f5fff5';

  const sinceCall = Math.floor((now - new Date(call.called_at).getTime()) / 1000);
  const m = Math.floor(sinceCall / 60);
  const s = sinceCall % 60;
  const timeStr = `${m}m ${s}s`;

  return (
    <Card sx={{ borderLeft: `6px solid ${borderColor}`, bgcolor: bgColor, mb: 0 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
            {call.machine_name || `Machine #${call.machine_id}`}
          </Typography>
          <Chip
            label={isOpen ? 'WAITING' : isInProgress ? 'IN PROGRESS' : 'RESOLVED'}
            size="small"
            sx={{
              bgcolor: borderColor,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.7rem'
            }}
          />
        </Box>

        {call.machine_location && (
          <Typography variant="body2" color="text.secondary" mb={0.5}>
            {call.machine_location}
          </Typography>
        )}

        <Typography variant="h5" fontWeight="bold" color={isOpen ? 'error' : 'warning.dark'} mb={0.5}>
          {timeStr}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Called by: <strong>{call.operator_name}</strong>
        </Typography>

        {call.technician_name && (
          <Typography variant="body2" color="text.secondary">
            Tech: <strong>{call.technician_name}</strong>
          </Typography>
        )}

        {call.priority === 'critical' && (
          <Chip label="CRITICAL" size="small" color="error" sx={{ mt: 0.5, fontWeight: 'bold' }} />
        )}
      </CardContent>
    </Card>
  );
}

const CallBoard: React.FC = () => {
  const [calls, setCalls] = useState<MaintenanceCall[]>([]);
  const [now, setNow] = useState(Date.now());

  const fetchActive = useCallback(async () => {
    try {
      const data = await maintenanceCallService.getActiveCalls();
      setCalls(data);
    } catch (err) {
      console.error('Failed to fetch active calls:', err);
    }
  }, []);

  useEffect(() => {
    fetchActive();

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('maintenance_call_created', () => fetchActive());
    socket.on('maintenance_call_updated', () => fetchActive());
    socket.on('maintenance_call_resolved', () => fetchActive());

    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      socket.disconnect();
      clearInterval(tick);
    };
  }, [fetchActive]);

  const open = calls.filter(c => c.status === 'open');
  const inProgress = calls.filter(c => c.status === 'in_progress');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1a2e', color: 'white', p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" color="white">
          MAINTENANCE CALL BOARD
        </Typography>
        <Typography variant="body1" color="grey.400">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* OPEN column */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" mb={2} gap={1}>
            <Warning sx={{ color: '#f44336', fontSize: 28 }} />
            <Typography variant="h5" fontWeight="bold" color="#f44336">
              WAITING FOR TECH
            </Typography>
            <Chip label={open.length} sx={{ bgcolor: '#f44336', color: 'white', fontWeight: 'bold' }} />
          </Box>

          {open.length === 0 ? (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, p: 3, textAlign: 'center' }}>
              <Typography color="grey.500">No open calls</Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={1.5}>
              {open.map(c => <CallCard key={c.call_id} call={c} now={now} />)}
            </Box>
          )}
        </Grid>

        {/* IN PROGRESS column */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" mb={2} gap={1}>
            <Engineering sx={{ color: '#ff9800', fontSize: 28 }} />
            <Typography variant="h5" fontWeight="bold" color="#ff9800">
              IN PROGRESS
            </Typography>
            <Chip label={inProgress.length} sx={{ bgcolor: '#ff9800', color: 'white', fontWeight: 'bold' }} />
          </Box>

          {inProgress.length === 0 ? (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, p: 3, textAlign: 'center' }}>
              <Typography color="grey.500">No calls in progress</Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={1.5}>
              {inProgress.map(c => <CallCard key={c.call_id} call={c} now={now} />)}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Footer summary */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 3 }} />
      <Box display="flex" gap={4} justifyContent="center">
        <Box textAlign="center">
          <Typography variant="h4" fontWeight="bold" color="#f44336">{open.length}</Typography>
          <Typography variant="body2" color="grey.400">WAITING</Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" fontWeight="bold" color="#ff9800">{inProgress.length}</Typography>
          <Typography variant="body2" color="grey.400">IN PROGRESS</Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h4" fontWeight="bold" color="#4caf50">{calls.length === 0 ? 0 : 0}</Typography>
          <Typography variant="body2" color="grey.400">ALL CLEAR</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CallBoard;
