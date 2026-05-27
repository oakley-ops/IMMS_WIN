'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress, Tabs, Tab } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import { MCS_ORANGE } from '../../theme';

// Client-only components (use localStorage via Axios interceptors).
const BadgeAdmin = dynamic(() => import('../../components/BadgeAdmin'), { ssr: false });
const PermissionsPanel = dynamic(() => import('../../components/admin/PermissionsPanel'), { ssr: false });

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, redirectToLogin } = useAuth();
  const [tab, setTab] = useState(0);

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

  const isAdmin = user?.role === 'admin';

  return (
    <NavLayout>
      <Box p={3}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          TabIndicatorProps={{ style: { backgroundColor: MCS_ORANGE } }}
        >
          <Tab label="Badge Admin" sx={{ '&.Mui-selected': { color: MCS_ORANGE } }} />
          {isAdmin && <Tab label="Permissions" sx={{ '&.Mui-selected': { color: MCS_ORANGE } }} />}
        </Tabs>

        {tab === 0 && <BadgeAdmin />}
        {tab === 1 && isAdmin && <PermissionsPanel />}
      </Box>
    </NavLayout>
  );
}
