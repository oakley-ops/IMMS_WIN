// frontend/src/components/demo/DemoRoleSwitcher.tsx
import React, { useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';

const ROLES = ['admin', 'purchaser', 'viewer'] as const;
type DemoRole = typeof ROLES[number];

const ROLE_LABELS: Record<DemoRole, string> = {
  admin: 'Admin',
  purchaser: 'Purchaser',
  viewer: 'Viewer',
};

interface Props {
  currentRole: string | null;
}

const DemoRoleSwitcher: React.FC<Props> = ({ currentRole }) => {
  const location = useLocation();
  const [switching, setSwitching] = useState(false);

  const switchRole = async (role: DemoRole) => {
    if (switching || currentRole === role) return;
    setSwitching(true);
    try {
      const res = await axiosInstance.post(`/api/v1/demo/login?role=${role}`);
      const { token } = res.data;
      localStorage.setItem('token', token);
      // Persist across the reload — AuthContext wipes the token on unload unless rememberMe is set
      localStorage.setItem('rememberMe', 'true');
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      window.location.href = location.pathname;
    } catch (err) {
      console.error('Role switch failed', err);
      setSwitching(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#555', mr: 0.5 }}>
        Demo role:
      </Typography>
      {ROLES.map((role) => {
        const active = currentRole === role;
        return (
          <Chip
            key={role}
            label={ROLE_LABELS[role]}
            size="small"
            onClick={() => switchRole(role)}
            disabled={switching}
            sx={{
              height: 24,
              fontSize: '11px',
              fontWeight: 700,
              cursor: active ? 'default' : 'pointer',
              bgcolor: active ? 'rgba(255,107,53,0.18)' : 'transparent',
              border: '1px solid',
              borderColor: active ? 'rgba(255,107,53,0.5)' : '#333',
              color: active ? '#FF6B35' : '#666',
              '&:hover': {
                bgcolor: active ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.06)',
                borderColor: active ? 'rgba(255,107,53,0.5)' : '#555',
                color: active ? '#FF6B35' : '#aaa',
              },
            }}
          />
        );
      })}
    </Box>
  );
};

export default DemoRoleSwitcher;
