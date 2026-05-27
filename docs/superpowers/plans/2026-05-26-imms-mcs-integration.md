# IMMS → MCS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicate maintenance pages in IMMS with a single external SSO link to the MCS frontend, move BadgeAdmin into MCS, and wire both systems into the startup script.

**Architecture:** IMMS Navigation builds a JWT-fragment URL (`#token=<jwt>&user=<base64>`) and opens MCS in a new tab; MCS AuthContext already consumes this fragment. BadgeAdmin is a new component in MCS frontend using the existing MCS service. Five maintenance files are deleted from IMMS frontend.

**Tech Stack:** React 18 + TypeScript (IMMS), Next.js 14 + TypeScript (MCS), MUI v5, Vitest (MCS), Jest (IMMS)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/Navigation.tsx` | Modify | Replace maintenance nav item with external SSO link |
| `frontend/src/components/__tests__/Navigation.test.tsx` | Modify | Add tests for external MCS link behavior |
| `frontend/src/App.tsx` | Modify | Remove 4 maintenance routes + imports |
| `frontend/src/pages/MaintenanceCalls.tsx` | **Delete** | Replaced by MCS `/calls` |
| `frontend/src/components/CallBoard.tsx` | **Delete** | Replaced by MCS `/board` |
| `frontend/src/components/CallStation.tsx` | **Delete** | Replaced by MCS `/station` |
| `frontend/src/components/BadgeAdmin.tsx` | **Delete** | Moving to MCS |
| `frontend/src/services/maintenanceCallService.ts` | **Delete** | Only used by deleted files |
| `frontend/.env` | Modify | Add `REACT_APP_MCS_URL` |
| `maintenance_call_system/frontend/src/components/NavLayout.tsx` | Modify | Live Board → new tab; add Admin item; remove footer link |
| `maintenance_call_system/frontend/src/components/NavLayout.test.tsx` | **New** | Tests for nav changes |
| `maintenance_call_system/frontend/src/components/BadgeAdmin.tsx` | **New** | Badge + Reader admin UI |
| `maintenance_call_system/frontend/src/components/BadgeAdmin.test.tsx` | **New** | Tests for BadgeAdmin |
| `maintenance_call_system/frontend/src/app/admin/page.tsx` | **New** | Auth-guarded admin page |
| `start-app.bat` | Modify | Add MCS backend + frontend startup |

---

## Task 1: Create feature branch

- [ ] **Step 1: Create and switch to branch**

```bash
cd C:\Users\Fiser\fiservinventory_win
git checkout -b feat/imms-mcs-integration
```

Expected: `Switched to a new branch 'feat/imms-mcs-integration'`

---

## Task 2: IMMS Navigation — external SSO link

**Files:**
- Modify: `frontend/src/components/__tests__/Navigation.test.tsx`
- Modify: `frontend/src/components/Navigation.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `frontend/src/components/__tests__/Navigation.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { AuthProvider } from '../../contexts/AuthContext';

const renderNav = () =>
  render(
    <AuthProvider>
      <BrowserRouter>
        <Navigation><div>content</div></Navigation>
      </BrowserRouter>
    </AuthProvider>
  );

describe('Navigation Component', () => {
  test('renders navigation links', () => {
    renderNav();
    expect(screen.getByText(/PARTS/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/MACHINES/i)).toBeInTheDocument();
    expect(screen.getByText(/DASHBOARD/i)).toBeInTheDocument();
  });

  test('renders brand name', () => {
    renderNav();
    expect(screen.getByText(/IMMS/i)).toBeInTheDocument();
  });

  test('"MAINTENANCE CALLS" internal route is no longer in the nav', () => {
    renderNav();
    expect(screen.queryByText(/^MAINTENANCE CALLS$/i)).not.toBeInTheDocument();
  });

  test('"MAINTENANCE SYSTEM" renders as an external anchor with target="_blank"', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('"MAINTENANCE SYSTEM" href points to the MCS base URL', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    const href = link?.getAttribute('href') ?? '';
    expect(href).toMatch(/localhost:3003/);
    expect(href).toContain('#token=');
    expect(href).toContain('&user=');
  });
});
```

- [ ] **Step 2: Run — confirm RED**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx jest src/components/__tests__/Navigation.test.tsx --no-coverage
```

Expected: 2 new tests fail — `MAINTENANCE CALLS` still present, `MAINTENANCE SYSTEM` not found.

- [ ] **Step 3: Update `NavigationItem` interface in `Navigation.tsx`**

Replace the interface (around line 47):

```tsx
interface NavigationItem {
  path?: string;
  href?: string;
  external?: boolean;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: string;
}
```

- [ ] **Step 4: Add `OpenInNew` to the MUI icons import**

Find the icons import block (lines 18–36) and add `OpenInNew`:

```tsx
import {
  AccountCircle,
  Logout,
  Menu as MenuIcon,
  Dashboard,
  Inventory,
  Build,
  SwapHoriz,
  ShoppingCart,
  People,
  Assignment,
  BarChart,
  MonetizationOn,
  ReceiptLong,
  PrecisionManufacturing,
  Engineering,
  PlaylistAddCheck,
  Contacts as ContactsIcon,
  Category,
  Campaign,
  OpenInNew,
} from '@mui/icons-material';
```

- [ ] **Step 5: Add `buildMCSUrl` helper and replace the maintenance nav item**

Inside the `Navigation` component, directly after the `const { logout, user, hasPermission } = useAuth();` line, add:

```tsx
const MCS_BASE = process.env.REACT_APP_MCS_URL || 'http://localhost:3003';
const buildMCSUrl = (): string => {
  const token = localStorage.getItem('token') || '';
  const userEncoded = btoa(JSON.stringify({
    id: user?.id,
    username: user?.username,
    role: user?.role,
  }));
  return `${MCS_BASE}#token=${token}&user=${userEncoded}`;
};
```

In the `navigationItems` array, replace:
```tsx
{ path: '/maintenance-calls', label: 'MAINTENANCE CALLS', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' },
```
with:
```tsx
{ href: buildMCSUrl(), external: true, label: 'MAINTENANCE SYSTEM', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' },
```

- [ ] **Step 6: Update the nav list renderer to handle external links**

Find the `filteredNavigationItems.map(({ path, label, icon }) => (` block (around line 136) and replace it entirely:

```tsx
{filteredNavigationItems.map(({ path, href, external, label, icon }) => (
  <ListItem
    button
    key={label}
    component={external ? 'a' : Link}
    {...(external
      ? { href, target: '_blank', rel: 'noopener noreferrer' }
      : { to: path! }
    )}
    selected={!external && location.pathname === path}
    onClick={() => setDrawerOpen(false)}
    sx={{
      py: 1.5,
      bgcolor: !external && location.pathname === path
        ? 'rgba(255, 255, 255, 0.2)'
        : 'transparent',
      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
    }}
  >
    <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>{icon}</ListItemIcon>
    <ListItemText
      primary={label}
      sx={{
        '& .MuiListItemText-primary': {
          fontSize: '0.9rem',
          fontWeight: !external && location.pathname === path ? 'bold' : 'normal',
        },
      }}
    />
    {external && <OpenInNew sx={{ fontSize: 14, opacity: 0.6, color: 'white' }} />}
  </ListItem>
))}
```

- [ ] **Step 7: Run — confirm GREEN**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx jest src/components/__tests__/Navigation.test.tsx --no-coverage
```

Expected: all 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add frontend/src/components/Navigation.tsx frontend/src/components/__tests__/Navigation.test.tsx
git commit -m "feat(imms): replace maintenance nav with external MCS SSO link"
```

---

## Task 3: IMMS App.tsx — remove maintenance routes

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Remove the four maintenance imports from `App.tsx`**

Delete these lines from the import section at the top of `frontend/src/App.tsx`:

```tsx
import CallBoard from './components/CallBoard';
import CallStation from './components/CallStation';
import MaintenanceCalls from './pages/MaintenanceCalls';
import BadgeAdmin from './components/BadgeAdmin';
```

- [ ] **Step 2: Remove the four maintenance routes from `App.tsx`**

Delete these four `<Route>` blocks from the `<Routes>` section:

```tsx
{/* Maintenance Call Board — public, no auth (TV display) */}
<Route path="/maintenance-board" element={<CallBoard />} />

{/* Maintenance Call Station — public, no auth (kiosk at machine) */}
<Route path="/maintenance-call/station" element={<CallStation />} />

{/* Maintenance Calls management */}
<Route
  path="/maintenance-calls"
  element={
    <ProtectedRoute requiredPermission="CAN_VIEW_MACHINES">
      <Navigation>
        <MaintenanceCalls />
      </Navigation>
    </ProtectedRoute>
  }
/>

{/* Badge & Reader Admin */}
<Route
  path="/maintenance-calls/admin"
  element={
    <ProtectedRoute requiredPermission="CAN_MANAGE_USERS">
      <Navigation>
        <BadgeAdmin />
      </Navigation>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add frontend/src/App.tsx
git commit -m "feat(imms): remove duplicate maintenance routes from App.tsx"
```

---

## Task 4: Delete IMMS maintenance files

**Files:** 5 deletions

- [ ] **Step 1: Delete the five files**

```bash
cd C:\Users\Fiser\fiservinventory_win
git rm frontend/src/pages/MaintenanceCalls.tsx
git rm frontend/src/components/CallBoard.tsx
git rm frontend/src/components/CallStation.tsx
git rm frontend/src/components/BadgeAdmin.tsx
git rm frontend/src/services/maintenanceCallService.ts
```

- [ ] **Step 2: Verify no remaining references**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx tsc --noEmit
```

Expected: no errors (all references were already removed in Task 3).

- [ ] **Step 3: Run full IMMS frontend tests to check for regressions**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx jest --no-coverage --testPathIgnorePatterns=node_modules
```

Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git commit -m "feat(imms): delete duplicate maintenance pages and service"
```

---

## Task 5: IMMS env config

**Files:**
- Modify: `frontend/.env`

- [ ] **Step 1: Add MCS URL to IMMS `.env`**

Open `frontend/.env` and add this line:

```
REACT_APP_MCS_URL=http://localhost:3003
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\Fiservinventory_win
git add frontend/.env
git commit -m "feat(imms): add REACT_APP_MCS_URL env var"
```

---

## Task 6: MCS NavLayout — Live Board new tab + Admin item

**Files:**
- New: `maintenance_call_system/frontend/src/components/NavLayout.test.tsx`
- Modify: `maintenance_call_system/frontend/src/components/NavLayout.tsx`

- [ ] **Step 1: Write the failing tests**

Create `maintenance_call_system/frontend/src/components/NavLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Next.js Link so it renders as a plain <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children, target, rel }: {
    href: string; children: React.ReactNode; target?: string; rel?: string;
  }) => <a href={href} target={target} rel={rel}>{children}</a>,
}));

// Mock AuthContext so we control the user
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import NavLayout from './NavLayout';
import { useAuth } from '../contexts/AuthContext';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const techUser = { user: { id: 1, username: 'tech', role: 'tech' }, logout: vi.fn(), redirectToLogin: vi.fn() };
const adminUser = { user: { id: 2, username: 'admin', role: 'admin' }, logout: vi.fn(), redirectToLogin: vi.fn() };

describe('NavLayout', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(techUser);
  });

  it('Live Board link has target="_blank"', () => {
    render(<NavLayout><div /></NavLayout>);
    const link = screen.getByText('Live Board').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('Admin nav item is visible for admin role', () => {
    mockUseAuth.mockReturnValue(adminUser);
    render(<NavLayout><div /></NavLayout>);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('Admin nav item is hidden for non-admin roles', () => {
    render(<NavLayout><div /></NavLayout>);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('does not render "Open Board in New Tab" footer link', () => {
    render(<NavLayout><div /></NavLayout>);
    expect(screen.queryByText(/Open Board in New Tab/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm RED**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run src/components/NavLayout.test.tsx
```

Expected: 4 tests fail — Live Board lacks `target="_blank"`, Admin item missing, footer link still present.

- [ ] **Step 3: Update `NavLayout.tsx`**

Replace the full contents of `maintenance_call_system/frontend/src/components/NavLayout.tsx`:

```tsx
'use client';
import React from 'react';
import Link from 'next/link';
import {
  Box, AppBar, Toolbar, Typography, Button, Drawer,
  List, ListItem, ListItemIcon, ListItemText, Divider, IconButton,
} from '@mui/material';
import { Dashboard, History, Logout, Menu as MenuIcon, Campaign, Insights, Settings } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MCS_ORANGE, DARK_BG } from '../theme';

const DRAWER_WIDTH = 220;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  newTab?: boolean;
}

export default function NavLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, redirectToLogin } = useAuth();
  const [open, setOpen] = React.useState(false);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME;

  const navItems: NavItem[] = [
    { label: 'Call History', href: '/calls',     icon: <History /> },
    { label: 'Live Board',   href: '/board',     icon: <Dashboard />, newTab: true },
    { label: 'Analytics',    href: '/analytics', icon: <Insights /> },
    ...(user?.role === 'admin'
      ? [{ label: 'Admin', href: '/admin', icon: <Settings /> }]
      : []),
  ];

  return (
    <Box display="flex" minHeight="100vh">
      <AppBar position="fixed" sx={{ bgcolor: DARK_BG, zIndex: t => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(o => !o)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Campaign sx={{ color: MCS_ORANGE, mr: 1 }} />
          <Typography variant="h6" fontWeight="bold" color={MCS_ORANGE} sx={{ flexGrow: 1 }}>
            MCS{siteName ? ` — ${siteName}` : ''}
          </Typography>
          <Typography variant="body2" color="grey.400" sx={{ mr: 2 }}>{user?.username}</Typography>
          <Button
            color="inherit"
            startIcon={<Logout />}
            size="small"
            onClick={() => { logout(); redirectToLogin(); }}
          >
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: '#1E1E1E', color: 'white', mt: '64px' } }}
      >
        <List>
          {navItems.map(item => (
            <ListItem
              key={item.href}
              component={Link}
              href={item.href}
              {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => setOpen(false)}
              sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,107,53,0.1)' } }}
            >
              <ListItemIcon sx={{ color: MCS_ORANGE, minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, mt: '64px', bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}
      >
        {children}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run — confirm GREEN**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run src/components/NavLayout.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full MCS test suite — no regressions**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run --exclude="**/node_modules/**"
```

Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add maintenance_call_system/frontend/src/components/NavLayout.tsx \
        maintenance_call_system/frontend/src/components/NavLayout.test.tsx
git commit -m "feat(mcs): Live Board opens new tab, add Admin nav item, remove footer link"
```

---

## Task 7: MCS BadgeAdmin component

**Files:**
- New: `maintenance_call_system/frontend/src/components/BadgeAdmin.test.tsx`
- New: `maintenance_call_system/frontend/src/components/BadgeAdmin.tsx`

- [ ] **Step 1: Write the failing tests**

Create `maintenance_call_system/frontend/src/components/BadgeAdmin.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { getBadges, getReaders, getMachines } = vi.hoisted(() => ({
  getBadges: vi.fn(),
  getReaders: vi.fn(),
  getMachines: vi.fn(),
}));

vi.mock('../services/maintenanceCallService', () => ({
  default: { getBadges, getReaders, getMachines },
}));

import BadgeAdmin from './BadgeAdmin';

beforeEach(() => {
  getBadges.mockResolvedValue([]);
  getReaders.mockResolvedValue([]);
  getMachines.mockResolvedValue([]);
});

describe('BadgeAdmin', () => {
  it('renders Badges and Readers tabs', async () => {
    render(<BadgeAdmin />);
    expect(await screen.findByRole('tab', { name: /Badges/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Readers/i })).toBeInTheDocument();
  });

  it('calls getBadges, getReaders, and getMachines on mount', async () => {
    render(<BadgeAdmin />);
    await waitFor(() => {
      expect(getBadges).toHaveBeenCalledTimes(1);
      expect(getReaders).toHaveBeenCalledTimes(1);
      expect(getMachines).toHaveBeenCalledTimes(1);
    });
  });

  it('displays registered badges in the Badges tab', async () => {
    getBadges.mockResolvedValueOnce([
      { badge_id: 'B001', person_name: 'Alice Smith', role: 'operator', technician_id: null, active: true },
    ]);
    render(<BadgeAdmin />);
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('B001')).toBeInTheDocument();
  });

  it('station URL in Readers tab uses /station?reader= not /maintenance-call/station', async () => {
    getReaders.mockResolvedValueOnce([
      { reader_id: 1, reader_key: 'press-1', machine_id: 1, machine_name: 'Press 701', location_label: 'Bay 1', active: true },
    ]);
    render(<BadgeAdmin />);
    // Switch to Readers tab
    const readersTab = await screen.findByRole('tab', { name: /Readers/i });
    await userEvent.click(readersTab);
    await waitFor(() => {
      // Should contain MCS-style path
      expect(screen.getByText(/\/station\?reader=press-1/i)).toBeInTheDocument();
      // Must NOT contain IMMS-style path
      expect(screen.queryByText(/maintenance-call\/station/i)).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run — confirm RED**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run src/components/BadgeAdmin.test.tsx
```

Expected: all 4 tests fail with "Cannot find module './BadgeAdmin'".

- [ ] **Step 3: Create `BadgeAdmin.tsx`**

Create `maintenance_call_system/frontend/src/components/BadgeAdmin.tsx`:

```tsx
'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { Add, Edit, Badge, Router } from '@mui/icons-material';
import svc from '../services/maintenanceCallService';
import type { BadgeRegistration, BadgeReader } from '../services/maintenanceCallService';

interface Machine { machine_id: number; name: string; }

const MCS_BASE = process.env.NEXT_PUBLIC_MCS_URL || 'http://localhost:3003';

export default function BadgeAdmin() {
  const [tab, setTab] = useState(0);
  const [badges, setBadges] = useState<BadgeRegistration[]>([]);
  const [readers, setReaders] = useState<BadgeReader[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Badge dialog
  const [badgeDialog, setBadgeDialog] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeRegistration | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    badge_id: '', person_name: '', role: 'operator' as 'operator' | 'technician', technician_id: '',
  });

  // Reader dialog
  const [readerDialog, setReaderDialog] = useState(false);
  const [editReader, setEditReader] = useState<BadgeReader | null>(null);
  const [readerForm, setReaderForm] = useState({ reader_key: '', machine_id: '', location_label: '' });

  // HID badge capture
  const [capturingBadge, setCapturingBadge] = useState(false);
  const bufferRef = React.useRef('');
  const lastKeyRef = React.useRef(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, m] = await Promise.all([
        svc.getBadges(),
        svc.getReaders(),
        svc.getMachines(),
      ]);
      setBadges(b);
      setReaders(r);
      setMachines(m);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // HID keyboard capture for badge registration
  useEffect(() => {
    if (!capturingBadge) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyRef.current > 500) bufferRef.current = '';
      lastKeyRef.current = now;
      if (e.key === 'Enter') {
        const badge = bufferRef.current.trim();
        bufferRef.current = '';
        if (badge.length > 3) {
          setBadgeForm(f => ({ ...f, badge_id: badge }));
          setCapturingBadge(false);
        }
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [capturingBadge]);

  const openNewBadge = () => {
    setEditBadge(null);
    setBadgeForm({ badge_id: '', person_name: '', role: 'operator', technician_id: '' });
    setBadgeDialog(true);
  };

  const openEditBadge = (b: BadgeRegistration) => {
    setEditBadge(b);
    setBadgeForm({ badge_id: b.badge_id, person_name: b.person_name, role: b.role, technician_id: b.technician_id?.toString() || '' });
    setBadgeDialog(true);
  };

  const saveBadge = async () => {
    setError('');
    try {
      const payload = {
        badge_id: badgeForm.badge_id,
        person_name: badgeForm.person_name,
        role: badgeForm.role,
        technician_id: badgeForm.technician_id ? parseInt(badgeForm.technician_id) : undefined,
      };
      if (editBadge) {
        await svc.updateBadge(editBadge.badge_id, payload);
      } else {
        await svc.registerBadge(payload);
      }
      setSuccess('Badge saved');
      setBadgeDialog(false);
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save badge');
    }
  };

  const openNewReader = () => {
    setEditReader(null);
    setReaderForm({ reader_key: '', machine_id: '', location_label: '' });
    setReaderDialog(true);
  };

  const openEditReader = (r: BadgeReader) => {
    setEditReader(r);
    setReaderForm({ reader_key: r.reader_key, machine_id: r.machine_id?.toString() || '', location_label: r.location_label || '' });
    setReaderDialog(true);
  };

  const saveReader = async () => {
    setError('');
    try {
      const payload = {
        reader_key: readerForm.reader_key,
        machine_id: parseInt(readerForm.machine_id),
        location_label: readerForm.location_label,
      };
      if (editReader) {
        await svc.updateReader(editReader.reader_id, payload);
      } else {
        await svc.registerReader(payload);
      }
      setSuccess('Reader saved');
      setReaderDialog(false);
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save reader');
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>Badge &amp; Reader Admin</Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Badge />} iconPosition="start" label={`Badges (${badges.length})`} />
        <Tab icon={<Router />} iconPosition="start" label={`Readers (${readers.length})`} />
      </Tabs>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : tab === 0 ? (

        /* ── Badges tab ── */
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={openNewBadge}>Register Badge</Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Badge ID</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {badges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No badges registered yet
                    </TableCell>
                  </TableRow>
                ) : badges.map(b => (
                  <TableRow key={b.badge_id} hover>
                    <TableCell><code>{b.badge_id}</code></TableCell>
                    <TableCell>{b.person_name}</TableCell>
                    <TableCell>
                      <Chip label={b.role} size="small" color={b.role === 'technician' ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={b.active ? 'Active' : 'Inactive'} size="small" color={b.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditBadge(b)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>

      ) : (

        /* ── Readers tab ── */
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={openNewReader}>Register Reader</Button>
          </Box>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Reader Key</strong></TableCell>
                  <TableCell><strong>Machine</strong></TableCell>
                  <TableCell><strong>Location Label</strong></TableCell>
                  <TableCell><strong>Station URL</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {readers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No readers registered yet
                    </TableCell>
                  </TableRow>
                ) : readers.map(r => (
                  <TableRow key={r.reader_id} hover>
                    <TableCell><code>{r.reader_key}</code></TableCell>
                    <TableCell>{r.machine_name}</TableCell>
                    <TableCell>{r.location_label}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                        {MCS_BASE}/station?reader={r.reader_key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.active ? 'Active' : 'Inactive'} size="small" color={r.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditReader(r)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* Badge dialog */}
      <Dialog open={badgeDialog} onClose={() => setBadgeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editBadge ? 'Edit Badge' : 'Register New Badge'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                label="Badge ID *"
                value={badgeForm.badge_id}
                onChange={e => setBadgeForm(f => ({ ...f, badge_id: e.target.value }))}
                fullWidth
                disabled={!!editBadge}
                placeholder={capturingBadge ? 'Scan badge now...' : 'Type or scan badge'}
                sx={{ input: { bgcolor: capturingBadge ? '#fff9c4' : undefined } }}
              />
              {!editBadge && (
                <Button
                  variant={capturingBadge ? 'contained' : 'outlined'}
                  color={capturingBadge ? 'warning' : 'primary'}
                  onClick={() => setCapturingBadge(v => !v)}
                  sx={{ whiteSpace: 'nowrap', minWidth: 110 }}
                >
                  {capturingBadge ? 'Scan Now...' : 'Scan Badge'}
                </Button>
              )}
            </Box>
            <TextField
              label="Person Name *"
              value={badgeForm.person_name}
              onChange={e => setBadgeForm(f => ({ ...f, person_name: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select
                value={badgeForm.role}
                label="Role *"
                onChange={e => setBadgeForm(f => ({ ...f, role: e.target.value as 'operator' | 'technician' }))}
              >
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBadgeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveBadge} disabled={!badgeForm.badge_id || !badgeForm.person_name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reader dialog */}
      <Dialog open={readerDialog} onClose={() => setReaderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editReader ? 'Edit Reader' : 'Register New Reader'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Reader Key *"
              value={readerForm.reader_key}
              onChange={e => setReaderForm(f => ({ ...f, reader_key: e.target.value }))}
              fullWidth
              helperText="Unique ID for this reader (used in the station URL)"
              disabled={!!editReader}
            />
            <FormControl fullWidth>
              <InputLabel>Machine *</InputLabel>
              <Select
                value={readerForm.machine_id}
                label="Machine *"
                onChange={e => setReaderForm(f => ({ ...f, machine_id: e.target.value }))}
              >
                <MenuItem value="">— Select Machine —</MenuItem>
                {machines.map(m => (
                  <MenuItem key={m.machine_id} value={m.machine_id.toString()}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Location Label"
              value={readerForm.location_label}
              onChange={e => setReaderForm(f => ({ ...f, location_label: e.target.value }))}
              fullWidth
              placeholder="e.g. Press #3 — Bay 2"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReaderDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveReader} disabled={!readerForm.reader_key || !readerForm.machine_id}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 4: Run — confirm GREEN**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run src/components/BadgeAdmin.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add maintenance_call_system/frontend/src/components/BadgeAdmin.tsx \
        maintenance_call_system/frontend/src/components/BadgeAdmin.test.tsx
git commit -m "feat(mcs): add BadgeAdmin component with Badges and Readers tabs"
```

---

## Task 8: MCS Admin page

**Files:**
- New: `maintenance_call_system/frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Create the admin page**

Create `maintenance_call_system/frontend/src/app/admin/page.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import BadgeAdmin from '../../components/BadgeAdmin';
import { MCS_ORANGE } from '../../theme';

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add maintenance_call_system/frontend/src/app/admin/page.tsx
git commit -m "feat(mcs): add /admin page with BadgeAdmin and auth guard"
```

---

## Task 9: Update start-app.bat

**Files:**
- Modify: `start-app.bat`

- [ ] **Step 1: Add MCS startup entries to `start-app.bat`**

Open `start-app.bat`. After the line:
```bat
timeout /t 8
```
(the wait after IMMS backend starts), add:

```bat
:: Start MCS Backend
echo Starting MCS Backend (http://0.0.0.0:4001)...
start /min cmd /k "cd maintenance_call_system\backend && npm start"

timeout /t 3

:: Start MCS Frontend
echo Starting MCS Frontend (http://localhost:3003)...
start /min cmd /k "cd maintenance_call_system\frontend && npm run dev"

timeout /t 3
```

- [ ] **Step 2: Update the summary echo block**

Find the section with the `echo PC ACCESS:` lines and add after the existing lines:

```bat
echo MCS ACCESS:  http://localhost:3003 (Maintenance Call System)
```

- [ ] **Step 3: Verify the bat file is syntactically valid**

```powershell
# Just check it opens without errors in a dry-run review
Get-Content C:\Users\Fiser\fiservinventory_win\start-app.bat
```

Verify the MCS entries appear in the correct position (after IMMS backend start, before IMMS frontend start).

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Fiser\fiservinventory_win
git add start-app.bat
git commit -m "feat: add MCS backend and frontend to start-app.bat"
```

---

## Task 10: Final verification and PR

- [ ] **Step 1: Run full IMMS frontend test suite**

```bash
cd C:\Users\Fiser\fiservinventory_win\frontend
npx jest --no-coverage --testPathIgnorePatterns=node_modules
```

Expected: all tests pass, no maintenance-related failures.

- [ ] **Step 2: Run full MCS frontend test suite**

```bash
cd C:\Users\Fiser\fiservinventory_win\maintenance_call_system\frontend
npx vitest run --exclude="**/node_modules/**"
```

Expected: all tests pass including new NavLayout, BadgeAdmin suites.

- [ ] **Step 3: Push branch and open PR**

```bash
cd C:\Users\Fiser\fiservinventory_win
git push origin feat/imms-mcs-integration
gh pr create \
  --title "feat: IMMS → MCS integration (SSO link, BadgeAdmin, cleanup)" \
  --body "## Summary
- Replaces duplicate maintenance pages in IMMS with an external SSO link to MCS
- Removes 5 files from IMMS frontend (MaintenanceCalls, CallBoard, CallStation, BadgeAdmin, maintenanceCallService)
- Adds BadgeAdmin page to MCS frontend at /admin (badges + readers, admin role only)
- MCS Live Board nav item opens a new tab; redundant footer link removed
- Updates start-app.bat to launch MCS backend (4001) and frontend (3003)

## Testing
- 5 new IMMS Navigation tests
- 4 new MCS NavLayout tests
- 4 new MCS BadgeAdmin tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
