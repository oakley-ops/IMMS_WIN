// frontend/src/components/demo/DemoBanner.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
`;

const DemoBanner: React.FC = () => (
  <Box
    sx={{
      background: 'linear-gradient(90deg, rgba(30,58,138,0.92), rgba(37,99,235,0.72))',
      borderBottom: '1px solid rgba(96,165,250,0.2)',
      px: 2,
      py: '5px',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}
  >
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: '#60a5fa',
        flexShrink: 0,
        animation: `${pulse} 2s ease-in-out infinite`,
      }}
    />
    <Typography variant="caption" sx={{ color: '#bfdbfe', lineHeight: 1 }}>
      <strong style={{ color: '#fff' }}>Demo environment</strong>
      {' '}— fully interactive · resets nightly · nothing here touches real systems
    </Typography>
  </Box>
);

export default DemoBanner;
