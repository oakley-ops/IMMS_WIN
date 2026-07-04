'use client';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { Warning, Engineering, ErrorOutline } from '@mui/icons-material';
import { STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_SUSPENDED } from '../../theme';

export type FeedbackState =
  | 'idle'
  | 'call_created'
  | 'call_acknowledged'
  | 'call_resumed'
  | 'already_active'
  | 'already_in_progress'
  | 'no_active_call'
  | 'unknown_badge'
  | 'parts_low_stock'
  | 'error';

const FEEDBACK: Record<Exclude<FeedbackState, 'idle'>, { label: string; bg: string; icon: React.ReactNode }> = {
  call_created:        { label: 'CALL SENT — HELP IS ON THE WAY', bg: '#7f0000', icon: <Warning sx={{ fontSize: 100, color: STATUS_OPEN }} /> },
  call_acknowledged:   { label: 'TECH IS ON THE WAY',             bg: '#4a2700', icon: <Engineering sx={{ fontSize: 100, color: STATUS_IN_PROGRESS }} /> },
  call_resumed:        { label: 'CALL RESUMED — TECH RETURNING',  bg: '#2a1a4a', icon: <Engineering sx={{ fontSize: 100, color: STATUS_SUSPENDED }} /> },
  already_active:      { label: 'CALL ALREADY OPEN',              bg: '#4a2700', icon: <Engineering sx={{ fontSize: 100, color: STATUS_IN_PROGRESS }} /> },
  already_in_progress: { label: 'TECH ALREADY IN PROGRESS',       bg: '#4a2700', icon: <Engineering sx={{ fontSize: 100, color: STATUS_IN_PROGRESS }} /> },
  no_active_call:      { label: 'NO ACTIVE CALL',                 bg: '#1a2a1a', icon: <ErrorOutline sx={{ fontSize: 100, color: '#66BB6A' }} /> },
  unknown_badge:       { label: 'BADGE NOT REGISTERED — SEE ADMIN', bg: '#1a1a1a', icon: <ErrorOutline sx={{ fontSize: 100, color: '#9E9E9E' }} /> },
  parts_low_stock:     { label: 'RESOLVED — PART NOT DEDUCTED, TELL A LEAD', bg: '#4a3200', icon: <Warning sx={{ fontSize: 100, color: '#FFB74D' }} /> },
  error:               { label: 'ERROR — TRY AGAIN',              bg: '#1a1a1a', icon: <ErrorOutline sx={{ fontSize: 100, color: '#9E9E9E' }} /> },
};

export const feedbackBg = (state: FeedbackState): string | null =>
  state === 'idle' ? null : FEEDBACK[state].bg;

interface Props {
  state: FeedbackState;
}

const FeedbackOverlay: React.FC<Props> = ({ state }) => {
  if (state === 'idle') return null;
  const fb = FEEDBACK[state];
  return (
    <Box textAlign="center" color="white">
      {fb.icon}
      <Typography variant="h3" fontWeight="bold" mt={3} sx={{ letterSpacing: 2, maxWidth: 700 }}>
        {fb.label}
      </Typography>
    </Box>
  );
};

export default FeedbackOverlay;
