// frontend/src/pages/DemoLandingPage.tsx
import React from 'react';
import { Box, Typography, Button, Chip, Grid } from '@mui/material';
import { motion, Variants } from 'framer-motion';
import {
  Layers, Settings, ShoppingCart, Wrench, Diamond, BarChart2, Package,
} from 'lucide-react';
import axiosInstance from '../utils/axios';

const PRIMARY = '#FF6B35';
const DARK_BG = '#121212';
const SURFACE = '#141414';
const DARK_STRIP = '#0e0e0e';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay, ease: 'easeOut' },
  }),
};

const FEATURES = [
  { icon: <Layers size={17} />,      title: 'Parts Inventory',    desc: 'Stock levels, minimums & usage history' },
  { icon: <Settings size={17} />,    title: 'Machines',           desc: 'Equipment, installs & part assignments' },
  { icon: <ShoppingCart size={17} />,title: 'Purchase Orders',    desc: 'Full PO lifecycle, approvals & receiving' },
  { icon: <Wrench size={17} />,      title: 'Work Orders',        desc: 'Assign, track & complete maintenance jobs' },
  { icon: <Diamond size={17} />,     title: 'Die Management',     desc: 'Die tracking, press fit & usage history' },
  { icon: <BarChart2 size={17} />,   title: 'Analytics',          desc: 'KPIs, low-stock alerts & inventory insights' },
];

const STATS = [
  { value: '847', label: 'Parts Tracked' },
  { value: '32',  label: 'Machines' },
  { value: '18',  label: 'Open POs' },
  { value: '9',   label: 'Below Minimum' },
];

type DemoRole = 'admin' | 'purchaser' | 'viewer';

const DemoLandingPage: React.FC = () => {
  const enterAs = async (role: DemoRole) => {
    try {
      const res = await axiosInstance.post(`/api/v1/demo/login?role=${role}`);
      const { token } = res.data;
      localStorage.setItem('token', token);
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Full page load so AuthProvider re-initializes and picks up the new token
      window.location.href = role === 'purchaser' ? '/purchase-orders' : '/dashboard';
    } catch (err) {
      console.error('Enter demo failed', err);
      alert('Could not start the demo — the server may still be waking up. Please try again in a few seconds.');
    }
  };

  return (
    <Box sx={{ bgcolor: DARK_BG, minHeight: '100vh', color: '#e2e8f0', fontFamily: 'inherit' }}>

      {/* Top bar */}
      <Box sx={{ height: 48, bgcolor: DARK_BG, borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', px: 2.5, gap: 1 }}>
        <Package color={PRIMARY} size={20} />
        <Typography fontWeight={800} fontSize={16} color={PRIMARY}>IMMS</Typography>
        <Box flex={1} />
        <Box sx={{ border: `1px solid rgba(255,107,53,0.4)`, borderRadius: 999, px: 1.5, py: 0.4, fontSize: 10, fontWeight: 700, color: PRIMARY, bgcolor: 'rgba(255,107,53,0.08)', letterSpacing: 0.6 }}>
          DEMO
        </Box>
      </Box>

      {/* Hero */}
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 7 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 4, md: 6 }, alignItems: { xs: 'stretch', md: 'center' } }}>
        <Box flex={1} minWidth={280}>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.05}>
            <Typography sx={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: PRIMARY, fontWeight: 700 }}>
              Inventory Management System
            </Typography>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.15}>
            <Typography variant="h3" fontWeight={800} color="#fff" sx={{ mt: 1.25, lineHeight: 1.12, fontSize: { xs: 26, md: 32 } }}>
              Parts, machines &amp; purchasing{' '}
              <Box component="em" sx={{ fontStyle: 'normal', color: PRIMARY }}>in one place</Box>
            </Typography>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.25}>
            <Typography sx={{ mt: 1.5, fontSize: 13.5, color: '#888', lineHeight: 1.6, maxWidth: 440 }}>
              A live demo loaded with realistic sample data — no signup needed. Jump in and click around exactly like a real user would.
            </Typography>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.35}>
            <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => enterAs('admin')}
                sx={{
                  bgcolor: PRIMARY, fontWeight: 700, fontSize: 14, px: 3, py: 1.25,
                  boxShadow: '0 8px 22px rgba(255,107,53,0.38)',
                  '&:hover': { bgcolor: '#E55A00', transform: 'translateY(-2px)', boxShadow: '0 14px 30px rgba(255,107,53,0.52)' },
                  transition: 'all .15s ease',
                }}
              >
                Enter Demo →
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" color="#555">or enter as</Typography>
                {(['purchaser', 'viewer'] as DemoRole[]).map((role) => (
                  <Chip
                    key={role}
                    label={role.charAt(0).toUpperCase() + role.slice(1)}
                    size="small"
                    onClick={() => enterAs(role)}
                    sx={{
                      border: '1px solid #333', color: '#888', fontWeight: 600, fontSize: 11,
                      '&:hover': { borderColor: PRIMARY, color: PRIMARY, bgcolor: 'rgba(255,107,53,0.08)' },
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Box>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#444' }}>
              ↻ Switch roles anytime from inside the app
            </Typography>
          </motion.div>
        </Box>

        {/* Mini app preview */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.45} style={{ flexShrink: 0 }}>
          <Box sx={{ width: 260, display: { xs: 'none', md: 'block' }, border: '1px solid #2a2a2a', borderRadius: 2, overflow: 'hidden', boxShadow: '0 20px 48px rgba(0,0,0,.6)' }}>
            <Box sx={{ height: 28, bgcolor: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', px: 1, gap: 0.5 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <Box key={c} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />)}
            </Box>
            <Box sx={{ display: 'flex', height: 130 }}>
              <Box sx={{ width: 34, bgcolor: '#1E1E1E', borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1, gap: 1.2 }}>
                {[PRIMARY, '#666', '#666', '#666'].map((c, i) => (
                  <Box key={i} sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: i === 0 ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 10, height: 10, bgcolor: c, borderRadius: 0.5, opacity: 0.9 }} />
                  </Box>
                ))}
              </Box>
              <Box sx={{ flex: 1, bgcolor: '#1a1a1a', p: 1.25 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff', mb: 0.75 }}>Dashboard</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mb: 0.75 }}>
                  {[['847','Parts'],['9','Low'],['18','POs']].map(([v, l]) => (
                    <Box key={l} sx={{ flex: 1, bgcolor: '#252525', border: '1px solid #2e2e2e', borderRadius: 1, p: '5px 7px' }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: l === 'Low' ? '#f59e0b' : '#fff' }}>{v}</Typography>
                      <Typography sx={{ fontSize: 8, color: '#555', textTransform: 'uppercase' }}>{l}</Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ bgcolor: '#252525', border: '1px solid #2e2e2e', borderRadius: 1, overflow: 'hidden' }}>
                  {[['HYD-SEAL-04','low'],['BRG-6205-2RS','ok'],['FILT-OIL-12','low']].map(([pn, status]) => (
                    <Box key={pn} sx={{ display: 'flex', justifyContent: 'space-between', px: 0.75, py: '4px', borderBottom: '1px solid #2e2e2e', '&:last-child': { borderBottom: 'none' } }}>
                      <Typography sx={{ fontSize: 8.5, color: '#ccc' }}>{pn}</Typography>
                      <Box sx={{ borderRadius: 0.5, px: 0.6, fontSize: 8, fontWeight: 700,
                        bgcolor: status === 'low' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
                        color: status === 'low' ? '#fca5a5' : '#86efac' }}>
                        {status.toUpperCase()}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* Stats strip */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', bgcolor: DARK_STRIP, borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e' }}>
        {STATS.map(({ value, label }, i) => (
          <motion.div key={label} variants={fadeUp} initial="hidden" animate="visible" custom={0.5 + i * 0.07} style={{ flex: 1 }}>
            <Box sx={{ px: 3, py: 2, minWidth: '120px', borderRight: i < STATS.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
              <Typography fontWeight={800} fontSize={20} color={PRIMARY}>{value}</Typography>
              <Typography fontSize={10} color="#555" textTransform="uppercase" letterSpacing={0.4}>{label}</Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Feature grid */}
      <Grid container sx={{ borderTop: '1px solid #1e1e1e' }}>
        {FEATURES.map(({ icon, title, desc }, i) => (
          <Grid item xs={12} sm={6} md={4} key={title}>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.55 + i * 0.07}>
              <Box
                sx={{
                  p: '18px 20px', bgcolor: SURFACE, borderRight: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e',
                  transition: 'background .15s', '&:hover': { bgcolor: '#1c1c1c' },
                }}
              >
                <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: 'rgba(255,107,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PRIMARY, mb: 1.25 }}>
                  {icon}
                </Box>
                <Typography fontWeight={700} fontSize={13} color="#e2e8f0" mb={0.4}>{title}</Typography>
                <Typography fontSize={11} color="#555" lineHeight={1.45}>{desc}</Typography>
              </Box>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Footer */}
      <Box sx={{ bgcolor: DARK_STRIP, borderTop: '1px solid #1a1a1a', px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PRIMARY, opacity: 0.4, flexShrink: 0 }} />
        <Typography fontSize={10.5} color="#333">
          Live sample data · resets nightly · nothing here touches real systems
        </Typography>
      </Box>

    </Box>
  );
};

export default DemoLandingPage;
