'use client';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import { MCS_ORANGE } from '../../theme';

// BadgeAdmin relies on client-only APIs (localStorage via Axios interceptor).
// Disable SSR to prevent hydration mismatches.
const BadgeAdmin = dynamic(() => import('../../components/BadgeAdmin'), { ssr: false });

export default function AdminPage() {
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
      <BadgeAdmin />
    </NavLayout>
  );
}
