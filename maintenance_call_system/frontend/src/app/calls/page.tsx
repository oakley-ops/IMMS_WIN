'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import MaintenanceCalls from '../../components/MaintenanceCalls';
import { MCS_ORANGE } from '../../theme';

export default function CallsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
      <MaintenanceCalls />
    </NavLayout>
  );
}
