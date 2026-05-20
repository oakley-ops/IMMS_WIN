import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import { CheckCircle, Warning, Engineering, ErrorOutline } from '@mui/icons-material';
import io from 'socket.io-client';
import maintenanceCallService, { BadgeReader, MaintenanceCall, BadgeSwipeResult } from '../services/maintenanceCallService';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
const HID_TIMEOUT_MS = 50; // chars arriving faster than this = badge reader, not keyboard

type FeedbackState = 'idle' | 'call_created' | 'call_acknowledged' | 'already_active' | 'already_in_progress' | 'no_active_call' | 'unknown_badge' | 'error';

const FEEDBACK_CONFIG: Record<FeedbackState, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  idle: { label: '', color: '#1a1a2e', icon: null, bg: '#1a1a2e' },
  call_created: { label: 'CALL SENT — HELP IS ON THE WAY', color: '#f44336', icon: <Warning sx={{ fontSize: 80 }} />, bg: '#b71c1c' },
  call_acknowledged: { label: 'TECH IS ON THE WAY', color: '#ff9800', icon: <Engineering sx={{ fontSize: 80 }} />, bg: '#e65100' },
  already_active: { label: 'CALL ALREADY OPEN', color: '#ff9800', icon: <Engineering sx={{ fontSize: 80 }} />, bg: '#e65100' },
  already_in_progress: { label: 'ALREADY IN PROGRESS', color: '#ff9800', icon: <Engineering sx={{ fontSize: 80 }} />, bg: '#e65100' },
  no_active_call: { label: 'NO ACTIVE CALL — SCAN OPERATOR BADGE FIRST', color: '#607d8b', icon: <ErrorOutline sx={{ fontSize: 80 }} />, bg: '#37474f' },
  unknown_badge: { label: 'BADGE NOT REGISTERED', color: '#9e9e9e', icon: <ErrorOutline sx={{ fontSize: 80 }} />, bg: '#424242' },
  error: { label: 'ERROR — TRY AGAIN', color: '#9e9e9e', icon: <ErrorOutline sx={{ fontSize: 80 }} />, bg: '#424242' },
};

const CallStation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const readerKey = searchParams.get('reader') || '';

  const [reader, setReader] = useState<BadgeReader | null>(null);
  const [activeCall, setActiveCall] = useState<MaintenanceCall | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [loading, setLoading] = useState(true);
  const [readerError, setReaderError] = useState('');

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveCall = useCallback(async (machineId: number) => {
    try {
      const calls = await maintenanceCallService.getActiveCalls();
      const call = calls.find(c => c.machine_id === machineId) || null;
      setActiveCall(call);
    } catch {
      // non-fatal
    }
  }, []);

  // Load reader info on mount
  useEffect(() => {
    if (!readerKey) {
      setReaderError('No reader key in URL. Use ?reader=YOUR_READER_KEY');
      setLoading(false);
      return;
    }

    maintenanceCallService.getReaderInfo(readerKey)
      .then(r => {
        setReader(r);
        setLoading(false);
        fetchActiveCall(r.machine_id);
      })
      .catch(() => {
        setReaderError('Reader not found or inactive. Check the reader_key in the URL.');
        setLoading(false);
      });
  }, [readerKey, fetchActiveCall]);

  // Socket.io for live updates
  useEffect(() => {
    if (!reader) return;

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    const refresh = () => fetchActiveCall(reader.machine_id);
    socket.on('maintenance_call_created', refresh);
    socket.on('maintenance_call_updated', refresh);
    socket.on('maintenance_call_resolved', refresh);

    return () => { socket.disconnect(); };
  }, [reader, fetchActiveCall]);

  const showFeedback = (state: FeedbackState) => {
    setFeedback(state);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 5000);
  };

  const handleBadgeScan = useCallback(async (badgeId: string) => {
    if (!reader) return;
    try {
      const result: BadgeSwipeResult = await maintenanceCallService.badgeSwipe(badgeId, readerKey);
      showFeedback(result.action as FeedbackState);
      if (result.call) setActiveCall(result.call);
      if (result.action === 'call_created') setActiveCall(result.call || null);
    } catch {
      showFeedback('error');
    }
  }, [reader, readerKey]);

  // Global keydown listener for HID badge reader detection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLast = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const badge = bufferRef.current.trim();
        bufferRef.current = '';
        if (badge.length > 3) {
          handleBadgeScan(badge);
        }
        return;
      }

      // If gap between keystrokes is too large, reset buffer (manual typing, not HID)
      if (timeSinceLast > 500 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBadgeScan]);

  const fb = FEEDBACK_CONFIG[feedback];
  const showingFeedback = feedback !== 'idle';

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#1a1a2e">
        <CircularProgress sx={{ color: 'white' }} size={60} />
      </Box>
    );
  }

  if (readerError) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#1a1a2e" p={4}>
        <Box textAlign="center">
          <ErrorOutline sx={{ fontSize: 80, color: '#f44336', mb: 2 }} />
          <Typography variant="h5" color="white">{readerError}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      sx={{
        bgcolor: showingFeedback ? fb.bg : '#1a1a2e',
        transition: 'background-color 0.4s ease',
        p: 4,
        userSelect: 'none',
      }}
    >
      {showingFeedback ? (
        /* Feedback overlay */
        <Box textAlign="center" color="white">
          {fb.icon}
          <Typography variant="h3" fontWeight="bold" mt={2} sx={{ letterSpacing: 2 }}>
            {fb.label}
          </Typography>
        </Box>
      ) : (
        /* Normal idle state */
        <Box textAlign="center" color="white">
          <Typography variant="h6" color="grey.400" mb={1} sx={{ letterSpacing: 4, textTransform: 'uppercase' }}>
            {reader?.location_label || 'Maintenance Station'}
          </Typography>

          <Typography variant="h2" fontWeight="bold" mb={3}>
            {reader?.machine_name || 'Machine'}
          </Typography>

          {activeCall ? (
            <Box>
              <Chip
                label={activeCall.status === 'open' ? 'CALL ACTIVE — WAITING FOR TECH' : 'TECH IN PROGRESS'}
                sx={{
                  bgcolor: activeCall.status === 'open' ? '#f44336' : '#ff9800',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  px: 2,
                  py: 1,
                  height: 'auto',
                  mb: 2
                }}
              />
              {activeCall.technician_name && (
                <Typography variant="h6" color="grey.300" mt={1}>
                  Tech: {activeCall.technician_name}
                </Typography>
              )}
            </Box>
          ) : (
            <Chip
              label="RUNNING"
              sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 'bold', fontSize: '1rem', px: 2, py: 1, height: 'auto', mb: 2 }}
            />
          )}

          <Typography variant="h5" color="grey.400" mt={4} sx={{ letterSpacing: 2 }}>
            SCAN BADGE TO {activeCall ? 'RESPOND' : 'CALL FOR HELP'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CallStation;
