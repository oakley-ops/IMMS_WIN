// frontend/src/pages/DemoMaintenanceOverview.tsx
// In-app presentation of the Maintenance Call System (MCS) for the hosted demo.
// Shows a feature summary + an annotated, step-by-step workflow using real
// screenshots captured from the live MCS app.
import React from 'react';
import { Box, Typography, Grid, Paper, Chip } from '@mui/material';
import {
  Monitor, ScanLine, ListChecks, BadgeCheck, BarChart3, Megaphone, ArrowRight,
} from 'lucide-react';

const PRIMARY = '#FF6B35';
const SURFACE = '#1E1E1E';
const BORDER = '#2a2a2a';

type ArrowDir = 'up' | 'down' | 'left' | 'right';

const ARROW_SX: Record<ArrowDir, object> = {
  down:  { bottom: -7, left: '50%', ml: '-7px', borderWidth: '7px 7px 0 7px', borderColor: `${PRIMARY} transparent transparent transparent` },
  up:    { top: -7, left: '50%', ml: '-7px', borderWidth: '0 7px 7px 7px', borderColor: `transparent transparent ${PRIMARY} transparent` },
  left:  { left: -7, top: '50%', mt: '-7px', borderWidth: '7px 7px 7px 0', borderColor: `transparent ${PRIMARY} transparent transparent` },
  right: { right: -7, top: '50%', mt: '-7px', borderWidth: '7px 0 7px 7px', borderColor: `transparent transparent transparent ${PRIMARY}` },
};

interface CalloutSpec { top: string; left: string; label: string; arrow: ArrowDir; }

const Callout: React.FC<CalloutSpec> = ({ top, left, label, arrow }) => (
  <Box sx={{ position: 'absolute', top, left, transform: 'translate(-50%, -50%)', zIndex: 3 }}>
    <Box
      sx={{
        position: 'relative',
        bgcolor: PRIMARY,
        color: '#fff',
        fontSize: { xs: 9.5, sm: 12 },
        fontWeight: 700,
        px: 1.25,
        py: 0.5,
        borderRadius: 1.5,
        boxShadow: '0 4px 14px rgba(0,0,0,.45)',
        whiteSpace: 'nowrap',
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 0,
          height: 0,
          borderStyle: 'solid',
          ...ARROW_SX[arrow],
        },
      }}
    >
      {label}
    </Box>
  </Box>
);

const Shot: React.FC<{ src: string; alt: string; callouts?: CalloutSpec[] }> = ({ src, alt, callouts }) => (
  <Box
    sx={{
      position: 'relative',
      maxWidth: 760,
      mx: 'auto',
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${BORDER}`,
      boxShadow: '0 12px 32px rgba(0,0,0,.5)',
    }}
  >
    <Box component="img" src={src} alt={alt} sx={{ display: 'block', width: '100%' }} />
    {callouts?.map((c, i) => <Callout key={i} {...c} />)}
  </Box>
);

const FEATURES = [
  { icon: <Monitor size={20} />,    title: 'Live Board',        desc: 'Real-time, color-coded status of every machine on the floor' },
  { icon: <ScanLine size={20} />,   title: 'Call Stations',     desc: 'Badge-tap stations at each machine to call and resolve' },
  { icon: <ListChecks size={20} />, title: 'Call History',      desc: 'Full audit trail of every call with timing & reasons' },
  { icon: <BadgeCheck size={20} />, title: 'Badge & Readers',   desc: 'Register technician badges and machine stations' },
  { icon: <BarChart3 size={20} />,  title: 'Analytics',         desc: 'Downtime cost, MTTA / MTTR, SLA %, parts consumed' },
];

interface Step {
  n: number;
  title: string;
  desc: string;
  img: string;
  alt: string;
  callouts: CalloutSpec[];
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'An operator calls for help',
    desc: 'Every machine has a station screen. The operator taps their RFID badge to raise a maintenance call instantly — no phone calls, no paperwork.',
    img: '/assets/mcs/mcs-station.png',
    alt: 'Maintenance call station',
    callouts: [{ top: '64%', left: '50%', arrow: 'up', label: 'Tap badge to call' }],
  },
  {
    n: 2,
    title: 'The call hits the Live Board',
    desc: 'It appears instantly on the shop-floor board. Every machine is color-coded in real time — running, waiting on a tech, technician present, suspended, or in PM.',
    img: '/assets/mcs/mcs-board.png',
    alt: 'Maintenance call live board',
    callouts: [{ top: '19%', left: '60%', arrow: 'up', label: 'Live status counts' }],
  },
  {
    n: 3,
    title: 'A technician responds & resolves',
    desc: 'The technician badges in at the machine to acknowledge the call, then badges again when the repair is done. Response and repair times are captured automatically.',
    img: '/assets/mcs/mcs-station.png',
    alt: 'Technician badges in at the station',
    callouts: [{ top: '64%', left: '50%', arrow: 'up', label: 'Badge in to acknowledge & resolve' }],
  },
  {
    n: 4,
    title: 'Every call is logged',
    desc: 'Each call is recorded with machine, operator, technician, shift, response time, repair time, downtime, and reason — a complete, searchable audit trail.',
    img: '/assets/mcs/mcs-calls.png',
    alt: 'Maintenance call history',
    callouts: [{ top: '33%', left: '72%', arrow: 'up', label: 'Auto-tracked response · repair · downtime' }],
  },
  {
    n: 5,
    title: 'Insights for management',
    desc: 'Downtime cost, MTTA, MTTR, SLA %, open & critical calls, and top parts consumed — raw calls become actionable insight, exportable to PDF.',
    img: '/assets/mcs/mcs-analytics.png',
    alt: 'Maintenance analytics dashboard',
    callouts: [
      { top: '62%', left: '57%', arrow: 'up', label: 'Mean time to repair' },
      { top: '13%', left: '88%', arrow: 'down', label: 'Export PDF' },
    ],
  },
];

const DemoMaintenanceOverview: React.FC = () => (
  <Box sx={{ maxWidth: 980, mx: 'auto', pb: 6 }}>

    {/* Hero */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(255,107,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PRIMARY }}>
        <Megaphone size={24} />
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={800}>Maintenance Call System</Typography>
        <Typography variant="body2" color="text.secondary">
          A companion module to IMMS — real-time maintenance dispatch for the shop floor. Here's how it works.
        </Typography>
      </Box>
    </Box>

    {/* Feature summary */}
    <Grid container spacing={1.5} sx={{ mt: 1, mb: 4 }}>
      {FEATURES.map((f) => (
        <Grid item xs={12} sm={6} md={2.4} key={f.title}>
          <Paper elevation={0} sx={{ height: '100%', p: 1.75, bgcolor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            <Box sx={{ color: PRIMARY, mb: 1 }}>{f.icon}</Box>
            <Typography fontWeight={700} fontSize={14} gutterBottom>{f.title}</Typography>
            <Typography fontSize={12} color="text.secondary" lineHeight={1.4}>{f.desc}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>

    {/* Workflow heading */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      <Box sx={{ width: 6, height: 28, bgcolor: PRIMARY, borderRadius: 1 }} />
      <Typography variant="h5" fontWeight={800}>How a maintenance call flows</Typography>
    </Box>

    {/* Steps */}
    {STEPS.map((s, idx) => (
      <Box key={s.n} sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5, maxWidth: 760, mx: 'auto' }}>
          <Box
            sx={{
              flexShrink: 0, width: 34, height: 34, borderRadius: '50%', bgcolor: PRIMARY, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16,
            }}
          >
            {s.n}
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={17}>{s.title}</Typography>
            <Typography fontSize={13.5} color="text.secondary" lineHeight={1.55}>{s.desc}</Typography>
          </Box>
        </Box>
        <Shot src={s.img} alt={s.alt} callouts={s.callouts} />
        {idx < STEPS.length - 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', color: PRIMARY, mt: 2.5, opacity: 0.7 }}>
            <ArrowRight size={26} style={{ transform: 'rotate(90deg)' }} />
          </Box>
        )}
      </Box>
    ))}

    {/* Setup / admin */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 6, mb: 3 }}>
      <Box sx={{ width: 6, height: 28, bgcolor: PRIMARY, borderRadius: 1 }} />
      <Typography variant="h5" fontWeight={800}>Set up in minutes</Typography>
    </Box>
    <Box sx={{ maxWidth: 760, mx: 'auto', mb: 1.5 }}>
      <Typography fontSize={13.5} color="text.secondary" lineHeight={1.55}>
        Admins register each technician's badge and each machine's reader station from one screen — assign a role, mark it active, and the station is live.
      </Typography>
    </Box>
    <Shot
      src="/assets/mcs/mcs-admin.png"
      alt="Badge and reader admin"
      callouts={[{ top: '39%', left: '85%', arrow: 'down', label: 'Register badges & readers' }]}
    />

    <Box sx={{ textAlign: 'center', mt: 5 }}>
      <Chip
        label="Live, real-time, and fully integrated with IMMS machines & parts"
        sx={{ bgcolor: 'rgba(255,107,53,0.12)', color: PRIMARY, fontWeight: 600, border: `1px solid rgba(255,107,53,0.3)` }}
      />
    </Box>
  </Box>
);

export default DemoMaintenanceOverview;
