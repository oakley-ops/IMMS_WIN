'use client';
import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import Analytics from '../../components/Analytics';
import { MCS_ORANGE } from '../../theme';

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading, redirectToLogin } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [isLoading, isAuthenticated, redirectToLogin]);

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress sx={{ color: MCS_ORANGE }} />
      </Box>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <NavLayout>
      <Analytics />
    </NavLayout>
  );
}
