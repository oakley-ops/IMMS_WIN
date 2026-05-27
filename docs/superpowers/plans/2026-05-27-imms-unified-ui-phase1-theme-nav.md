# IMMS Unified UI — Phase 1: Theme, Navigation & Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IMMS blue sidebar + hamburger menu with an MCS-style dark AppBar + persistent mini sidebar (64px icons → 240px on hover), and align the color palette to orange `#FF6B35`.

**Architecture:** Rewrite `theme/index.ts` with MCS design tokens, then replace `Navigation.tsx` with a new AppBar + mini-sidebar shell. Sidebar overlays content when expanded (content stays at `marginLeft: 64px` always). Update Login page to use the new tokens. Clean up legacy CSS.

**Tech Stack:** React 18, MUI v5, React Router v7, TypeScript.

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/src/theme/index.ts` |
| Modify | `frontend/src/components/Navigation.tsx` |
| Modify | `frontend/src/components/__tests__/Navigation.test.tsx` |
| Modify | `frontend/src/pages/Login.tsx` |
| Modify | `frontend/src/index.css` |

---

### Task 1: Update Theme Tokens

Replace IMMS blue/orange with MCS-aligned tokens. All subsequent phases depend on these exports.

**Files:**
- Modify: `frontend/src/theme/index.ts`

- [ ] **Step 1: Verify existing tests pass before any changes**

```bash
cd frontend && npm test -- --testPathPattern="Navigation" --watchAll=false
```
Expected: all 6 Navigation tests PASS (confirm baseline).

- [ ] **Step 2: Replace `frontend/src/theme/index.ts` entirely**

```typescript
import { createTheme } from '@mui/material';

// ── Shared design tokens (matches MCS) ──────────────────────────────────────
export const DARK_BG = '#121212';
export const DARK_SURFACE = '#1E1E1E';
export const PRIMARY_ORANGE = '#FF6B35';
export const PAGE_BG = '#F5F5F5';

// Status colors
export const COLOR_SUCCESS = '#66BB6A';
export const COLOR_SUCCESS_BG = '#E8F5E9';
export const COLOR_SUCCESS_TEXT = '#2E7D32';
export const COLOR_ERROR = '#EF5350';
export const COLOR_ERROR_BG = '#FFEBEE';
export const COLOR_ERROR_TEXT = '#C62828';
export const COLOR_WARNING = '#FFA726';
export const COLOR_WARNING_BG = '#FFF3E0';
export const COLOR_WARNING_TEXT = '#E65100';
export const COLOR_PURPLE_BG = '#F3E5F5';
export const COLOR_PURPLE_TEXT = '#6A1B9A';

export const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_ORANGE,
      contrastText: '#ffffff',
    },
    secondary: {
      main: DARK_SURFACE,
    },
    background: {
      default: PAGE_BG,
      paper: '#ffffff',
    },
    error: { main: COLOR_ERROR },
    success: { main: COLOR_SUCCESS },
    warning: { main: COLOR_WARNING },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/theme/index.ts
git commit -m "feat(theme): replace IMMS blue palette with MCS orange design tokens"
```

---

### Task 2: Rewrite Navigation Component

Replace the blue temporary drawer + hamburger with AppBar + persistent mini sidebar.

**Files:**
- Modify: `frontend/src/components/Navigation.tsx`
- Modify: `frontend/src/components/__tests__/Navigation.test.tsx`

- [ ] **Step 1: Update Navigation tests to match new structure**

The existing tests check for text content (PARTS, DASHBOARD, IMMS, etc.) and the external MCS link — those behaviors don't change. Update the test file to also test mini sidebar behavior:

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

const adminAuthContext = {
  user: { id: 1, username: 'admin', name: 'Admin User', role: 'ADMIN' },
  logout: jest.fn(),
  hasPermission: () => true,
  isAuthenticated: true,
  loading: false,
  userRole: 'ADMIN',
};

const unauthContext = {
  user: null,
  logout: jest.fn(),
  hasPermission: () => false,
  isAuthenticated: false,
  loading: false,
  userRole: null,
};

const renderNav = () =>
  render(
    <BrowserRouter>
      <Navigation><div>content</div></Navigation>
    </BrowserRouter>
  );

describe('Navigation Component', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(adminAuthContext);
  });

  test('renders AppBar with IMMS brand name', () => {
    renderNav();
    expect(screen.getAllByText('IMMS').length).toBeGreaterThanOrEqual(1);
  });

  test('renders navigation links', () => {
    renderNav();
    expect(screen.getByText(/PARTS/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/MACHINES/i)).toBeInTheDocument();
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  test('"MAINTENANCE SYSTEM" renders as an external anchor with target="_blank"', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('"MAINTENANCE SYSTEM" href points to MCS base URL with token fragment', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    const href = link?.getAttribute('href') ?? '';
    expect(href).toMatch(/localhost:3003/);
    expect(href).toContain('#token=');
    expect(href).toContain('&user=');
  });

  test('"MAINTENANCE SYSTEM" is hidden when user has no permissions', () => {
    mockUseAuth.mockReturnValue(unauthContext);
    renderNav();
    expect(screen.queryByText(/MAINTENANCE SYSTEM/i)).not.toBeInTheDocument();
  });

  test('"MAINTENANCE CALLS" internal route is not in the nav', () => {
    renderNav();
    expect(screen.queryByText(/^MAINTENANCE CALLS$/i)).not.toBeInTheDocument();
  });

  test('renders username in AppBar', () => {
    renderNav();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run updated tests — expect failures on "AppBar" test since component hasn't changed yet**

```bash
cd frontend && npm test -- --testPathPattern="Navigation" --watchAll=false
```
Expected: "renders AppBar with IMMS brand name" may show multiple matches or pass. Other tests PASS.

- [ ] **Step 3: Replace `frontend/src/components/Navigation.tsx` entirely**

```typescript
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  ThemeProvider,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  AppBar,
  Toolbar,
  Button,
  CssBaseline,
  Tooltip,
} from '@mui/material';
import {
  Logout,
  Dashboard,
  Inventory,
  Build,
  ShoppingCart,
  People,
  Assignment,
  BarChart,
  ReceiptLong,
  Engineering,
  PlaylistAddCheck,
  Contacts as ContactsIcon,
  Category,
  Campaign,
  OpenInNew,
  Inventory2,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { theme, DARK_BG, DARK_SURFACE, PRIMARY_ORANGE } from '../theme';

const MINI_WIDTH = 64;
const FULL_WIDTH = 240;
const APPBAR_HEIGHT = 56;

interface NavigationProps {
  children: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  path?: string;
  href?: string;
  external?: boolean;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: string;
}

const Navigation: React.FC<NavigationProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, hasPermission } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const MCS_BASE = process.env.REACT_APP_MCS_URL || 'http://localhost:3003';
  const buildMCSUrl = (): string => {
    const token = localStorage.getItem('token') || '';
    const userEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({
      id: user?.id,
      username: user?.username,
      role: user?.role,
    }))));
    return `${MCS_BASE}#token=${token}&user=${userEncoded}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections: NavSection[] = [
    {
      label: 'Inventory',
      items: [
        { path: '/dashboard', label: 'DASHBOARD', icon: <Dashboard /> },
        { path: '/parts', label: 'PARTS', icon: <Inventory /> },
        { path: '/purchase-orders', label: 'PURCHASE ORDERS', icon: <ShoppingCart />, requiredPermission: 'CAN_MANAGE_PURCHASE_ORDERS' },
        { path: '/transactions', label: 'TRANSACTIONS', icon: <ReceiptLong />, requiredPermission: 'CAN_VIEW_TRANSACTIONS' },
      ],
    },
    {
      label: 'Equipment',
      items: [
        { path: '/machines', label: 'MACHINES', icon: <Build />, requiredPermission: 'CAN_VIEW_MACHINES' },
        { path: '/work-orders', label: 'WORK ORDERS', icon: <Engineering />, requiredPermission: 'CAN_VIEW_MACHINES' },
        { path: '/pm-checklists', label: 'PM MANAGEMENT', icon: <PlaylistAddCheck />, requiredPermission: 'CAN_MANAGE_PM_CHECKLISTS' },
        { path: '/die-tracker', label: 'DIE MANAGEMENT', icon: <Category />, requiredPermission: 'CAN_VIEW_MACHINES' },
      ],
    },
    {
      label: 'Management',
      items: [
        { path: '/projects', label: 'PROJECTS', icon: <Assignment />, requiredPermission: 'CAN_MANAGE_PROJECTS' },
        { path: '/contacts', label: 'CONTACTS', icon: <ContactsIcon />, requiredPermission: 'CAN_VIEW_CONTACTS' },
        { path: '/technicians', label: 'TECHNICIANS', icon: <People />, requiredPermission: 'CAN_MANAGE_USERS' },
      ],
    },
    {
      label: 'External',
      items: [
        { href: buildMCSUrl(), external: true, label: 'MAINTENANCE SYSTEM', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' },
      ],
    },
  ];

  if (hasPermission('CAN_VIEW_ALL')) {
    navSections.push({
      label: 'Analytics',
      items: [
        { path: '/kpi-dashboard', label: 'KPI DASHBOARD', icon: <BarChart />, requiredPermission: 'CAN_VIEW_ALL' },
      ],
    });
  }

  const isActive = (item: NavItem) =>
    !item.external && item.path === location.pathname;

  const itemSx = (active: boolean) => ({
    py: 1,
    px: expanded ? 2 : 0,
    mx: expanded ? 1 : 0,
    borderRadius: expanded ? 1 : 0,
    justifyContent: expanded ? 'flex-start' : 'center',
    bgcolor: active ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
    '&:hover': { bgcolor: active ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.08)' },
    transition: 'all 0.15s ease',
  });

  const iconSx = (active: boolean) => ({
    color: active ? PRIMARY_ORANGE : '#AAAAAA',
    minWidth: expanded ? 36 : 0,
    justifyContent: 'center',
  });

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />

        {/* ── Top AppBar ─────────────────────────────────────────────────── */}
        <AppBar
          position="fixed"
          sx={{
            bgcolor: DARK_BG,
            zIndex: (t) => t.zIndex.drawer + 1,
            height: APPBAR_HEIGHT,
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: APPBAR_HEIGHT }}>
            <Inventory2 sx={{ color: PRIMARY_ORANGE, mr: 1 }} />
            <Typography
              variant="h6"
              fontWeight="bold"
              color={PRIMARY_ORANGE}
              sx={{ flexGrow: 1 }}
            >
              IMMS
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.400', mr: 2 }}>
              {user?.username}
            </Typography>
            <Button
              color="inherit"
              startIcon={<Logout />}
              size="small"
              onClick={handleLogout}
              sx={{ color: 'grey.300' }}
            >
              Sign Out
            </Button>
          </Toolbar>
        </AppBar>

        {/* ── Mini Sidebar ────────────────────────────────────────────────── */}
        <Drawer
          variant="permanent"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          sx={{
            width: expanded ? FULL_WIDTH : MINI_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: expanded ? FULL_WIDTH : MINI_WIDTH,
              overflowX: 'hidden',
              overflowY: 'auto',
              transition: 'width 0.2s ease',
              bgcolor: DARK_SURFACE,
              color: 'white',
              mt: `${APPBAR_HEIGHT}px`,
              height: `calc(100vh - ${APPBAR_HEIGHT}px)`,
              borderRight: 'none',
              // Overlay: sits above content when expanded
              position: 'fixed',
              zIndex: (t: any) => t.zIndex.drawer,
            },
          }}
        >
          {navSections.map((section, si) => {
            const visibleItems = section.items.filter(
              (item) => !item.requiredPermission || hasPermission(item.requiredPermission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <React.Fragment key={section.label}>
                {si > 0 && (
                  <Divider sx={{ bgcolor: '#333', mx: expanded ? 1 : 0, my: 0.5 }} />
                )}
                {expanded && (
                  <Typography
                    sx={{
                      color: '#666',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      px: 2,
                      pt: 1,
                      pb: 0.25,
                    }}
                  >
                    {section.label}
                  </Typography>
                )}
                <List dense disablePadding>
                  {visibleItems.map((item) => {
                    const active = isActive(item);
                    const listItem = (
                      <ListItem
                        key={item.label}
                        component={item.external ? 'a' : Link}
                        {...(item.external
                          ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
                          : { to: item.path ?? '/' }
                        )}
                        sx={itemSx(active)}
                        disablePadding={false}
                      >
                        <ListItemIcon sx={iconSx(active)}>
                          {item.icon}
                        </ListItemIcon>
                        {expanded && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: '13px',
                              fontWeight: active ? 600 : 400,
                              color: active ? PRIMARY_ORANGE : '#CCCCCC',
                              noWrap: true,
                            }}
                          />
                        )}
                        {expanded && item.external && (
                          <OpenInNew sx={{ fontSize: 12, color: '#666', ml: 0.5 }} />
                        )}
                      </ListItem>
                    );

                    return expanded ? listItem : (
                      <Tooltip key={item.label} title={item.label} placement="right">
                        {listItem}
                      </Tooltip>
                    );
                  })}
                </List>
              </React.Fragment>
            );
          })}
        </Drawer>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            mt: `${APPBAR_HEIGHT}px`,
            ml: `${MINI_WIDTH}px`,
            bgcolor: 'background.default',
            minHeight: `calc(100vh - ${APPBAR_HEIGHT}px)`,
            overflow: 'auto',
            p: 2,
          }}
        >
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Navigation;
```

- [ ] **Step 4: Run all Navigation tests**

```bash
cd frontend && npm test -- --testPathPattern="Navigation" --watchAll=false
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Navigation.tsx frontend/src/components/__tests__/Navigation.test.tsx
git commit -m "feat(nav): replace blue sidebar with dark AppBar + orange mini sidebar"
```

---

### Task 3: Clean Up index.css

Remove legacy Bootstrap-era global styles that are no longer used. Keep only base resets.

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace `frontend/src/index.css` with cleaned version**

```css
/* Base resets */
body {
  margin: 0;
  padding: 0;
  font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
}

#root {
  min-height: 100vh;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
}
::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
cd frontend && npm test -- --watchAll=false
```
Expected: all tests PASS (no tests depend on index.css classes).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: strip legacy Bootstrap/IMMS CSS from index.css"
```

---

### Task 4: Restyle Login Page

Remove `commonStyles` dependency and apply MCS-style dark login background.

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Replace the Login page styling while keeping all business logic unchanged**

The only change is visual — replace `commonStyles.container`, `commonStyles.title`, `commonStyles.subtitle`, `commonStyles.loginButton` references with inline `sx` props using the new tokens. All `useState`, `useEffect`, `handleSubmit`, security logic stays identical.

Replace the return statement's JSX (from `return (` to end of component) with:

```tsx
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: DARK_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Container maxWidth="xs">
          <Paper
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 2,
              borderTop: `4px solid ${PRIMARY_ORANGE}`,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              align="center"
              sx={{ color: PRIMARY_ORANGE, fontWeight: 'bold', mb: 0.5 }}
            >
              IMMS
            </Typography>
            <Typography
              variant="subtitle1"
              align="center"
              sx={{ color: 'text.secondary', mb: 3 }}
            >
              Inventory Management System
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label="Username"
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                sx={{ mb: 1 }}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                  />
                }
                label="Remember Me"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                Login
              </Button>
            </form>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
```

Also update the import at the top — remove `commonStyles` from the theme import:

```typescript
import { theme, PRIMARY_ORANGE, DARK_BG } from '../theme';
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test -- --watchAll=false
```
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): apply MCS dark theme styling to login page"
```

---

### Task 5: Final Phase 1 Verification

- [ ] **Step 1: Run the full test suite one more time**

```bash
cd frontend && npm test -- --watchAll=false
```
Expected: all tests PASS.

- [ ] **Step 2: Start the app and visually verify**

```bash
# From repo root
.\start-app.bat
```

Open `http://localhost:3002`. Verify:
- Dark AppBar at top with orange "IMMS" text
- Mini sidebar on left (dark, 64px wide) with icons
- Hover over sidebar → expands to 240px with grouped labels
- Dashboard content in light `#F5F5F5` area
- Login page: dark background with orange-accent card

- [ ] **Step 3: Final commit tagging Phase 1 complete**

```bash
git commit --allow-empty -m "chore: Phase 1 complete — theme, navigation, and login unified to MCS design"
```
