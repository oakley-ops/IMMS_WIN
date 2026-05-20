'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, CircularProgress, Chip, Button } from '@mui/material';
import { CheckCircle, ErrorOutline, PauseCircle } from '@mui/icons-material';

import svc, { BadgeSwipeResult } from '../services/maintenanceCallService';
import { useBadgeScanner } from '../hooks/useBadgeScanner';
import { useStationCall } from '../hooks/useStationCall';
import FeedbackOverlay, { FeedbackState, feedbackBg } from './station/FeedbackOverlay';
import ResolveDialog from './station/ResolveDialog';
import SuspendDialog from './station/SuspendDialog';
import {
  STATUS_OPEN,
  STATUS_IN_PROGRESS,
  STATUS_SUSPENDED,
  MCS_ORANGE,
} from '../theme';

const DARK_BG = '#121212';

const CallStation: React.FC = () => {
  const searchParams = useSearchParams();
  const readerKey = searchParams?.get('reader') || '';

  const { reader, activeCall, loading, error, refreshCall, setActiveCall } =
    useStationCall(readerKey);

  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const feedbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Tick once per second so the elapsed-time display stays current.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const showFeedback = (state: FeedbackState) => {
    setFeedback(state);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback('idle'), 5000);
  };

  const handleScan = async (badgeId: string) => {
    if (!reader) return;
    try {
      const result: BadgeSwipeResult = await svc.badgeSwipe(badgeId, readerKey);
      showFeedback(result.action as FeedbackState);
      if (result.call) setActiveCall(result.call);
    } catch {
      showFeedback('error');
    }
  };

  useBadgeScanner({
    onScan: handleScan,
    paused: resolveOpen || suspendOpen,
  });

  const handleResolve = async ({
    reason,
    notes,
    parts,
  }: {
    reason: string;
    notes: string;
    parts: { part_id: number; part_name: string; part_number: string; quantity: number }[];
  }) => {
    if (!activeCall) return;
    await svc.resolveCall(activeCall.call_id, {
      reason_category: reason || undefined,
      resolution_notes: notes,
    });
    if (parts.length > 0) await svc.logParts(activeCall.call_id, parts);
    setResolveOpen(false);
    setActiveCall(null);
    showFeedback('idle');
  };

  const handleSuspend = async (reason: string) => {
    if (!activeCall) return;
    await svc.suspendCall(activeCall.call_id, reason);
    setSuspendOpen(false);
    refreshCall();
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor={DARK_BG}>
        <CircularProgress sx={{ color: MCS_ORANGE }} size={72} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor={DARK_BG} gap={2}>
        <ErrorOutline sx={{ fontSize: 80, color: STATUS_OPEN }} />
        <Typography variant="h5" color="white" textAlign="center">{error}</Typography>
      </Box>
    );
  }

  const showingFeedback = feedback !== 'idle';
  const isInProgress = activeCall?.status === 'in_progress';
  const isSuspended = activeCall?.status === 'suspended';

  const elapsedStr = activeCall
    ? (() => {
        const secs = Math.floor((now - new Date(activeCall.called_at).getTime()) / 1000);
        return `${Math.floor(secs / 60)}m ${secs % 60}s`;
      })()
    : '';

  const statusColor = isSuspended
    ? STATUS_SUSPENDED
    : activeCall?.status === 'open'
    ? STATUS_OPEN
    : STATUS_IN_PROGRESS;

  const statusLabel = isSuspended
    ? '⏸ SUSPENDED — AWAITING RETURN'
    : activeCall?.status === 'open'
    ? '⚠ CALL ACTIVE — WAITING FOR TECH'
    : '🔧 TECH IN PROGRESS';

  const bg =
    feedbackBg(feedback) ??
    (isSuspended ? '#0d0a14' : activeCall ? '#0d0d1a' : DARK_BG);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      sx={{ bgcolor: bg, transition: 'background-color 0.5s ease', p: 4, userSelect: 'none' }}
    >
      {showingFeedback ? (
        <FeedbackOverlay state={feedback} />
      ) : (
        <Box textAlign="center" color="white" width="100%" maxWidth={700}>
          <Typography variant="h6" color="grey.500" mb={1} sx={{ letterSpacing: 4, textTransform: 'uppercase' }}>
            {reader?.location_label || 'Station'}
          </Typography>
          <Typography variant="h2" fontWeight="bold" mb={4}>
            {reader?.machine_name || 'Machine'}
          </Typography>

          {activeCall ? (
            <Box mb={4}>
              <Chip
                label={statusLabel}
                sx={{ bgcolor: statusColor, color: 'white', fontWeight: 700, fontSize: '1.1rem', px: 3, py: 1.5, height: 'auto', borderRadius: 2 }}
              />
              <Typography
                variant="h4"
                sx={{ fontFamily: '"Roboto Mono", monospace', mt: 2, color: isSuspended ? STATUS_SUSPENDED : STATUS_IN_PROGRESS }}
              >
                {elapsedStr}
              </Typography>

              {isSuspended && activeCall.suspension_notes && (
                <Box mt={2} px={4} py={2} sx={{ bgcolor: 'rgba(126,87,194,0.15)', borderRadius: 2, border: `1px solid ${STATUS_SUSPENDED}` }}>
                  <Typography variant="body1" color="grey.300" sx={{ letterSpacing: 1 }}>
                    REASON: {activeCall.suspension_notes.toUpperCase()}
                  </Typography>
                </Box>
              )}

              {activeCall.technician_name && (
                <Typography variant="h6" color="grey.400" mt={1}>
                  Technician: {activeCall.technician_name}
                </Typography>
              )}

              {isInProgress && (
                <Box display="flex" gap={3} justifyContent="center" mt={4}>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircle />}
                    onClick={() => setResolveOpen(true)}
                    sx={{ bgcolor: '#66BB6A', fontSize: '1.1rem', px: 4, py: 1.5, cursor: 'pointer' }}
                  >
                    Resolve Call
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PauseCircle />}
                    onClick={() => setSuspendOpen(true)}
                    sx={{ bgcolor: STATUS_SUSPENDED, fontSize: '1.1rem', px: 4, py: 1.5, cursor: 'pointer' }}
                  >
                    Suspend Call
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box mb={4}>
              <Chip
                label="RUNNING"
                sx={{ bgcolor: '#66BB6A', color: 'white', fontWeight: 700, fontSize: '1.1rem', px: 3, py: 1.5, height: 'auto', borderRadius: 2 }}
              />
            </Box>
          )}

          <Box sx={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 3, p: 4, mt: 2 }}>
            <Typography variant="h5" color="grey.400" sx={{ letterSpacing: 3 }}>
              SCAN BADGE TO {activeCall ? 'RESPOND' : 'CALL FOR MAINTENANCE'}
            </Typography>
          </Box>
        </Box>
      )}

      <ResolveDialog
        open={resolveOpen}
        machineName={reader?.machine_name}
        onClose={() => setResolveOpen(false)}
        onResolve={handleResolve}
      />

      <SuspendDialog
        open={suspendOpen}
        machineName={reader?.machine_name}
        onClose={() => setSuspendOpen(false)}
        onSuspend={handleSuspend}
      />
    </Box>
  );
};

export default CallStation;
