import React, { useState, useMemo } from 'react';
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
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
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
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { theme, DARK_BG, DARK_SURFACE, PRIMARY_ORANGE } from '../theme';
import DemoBanner from './demo/DemoBanner';
import DemoRoleSwitcher from './demo/DemoRoleSwitcher';
import DemoResetButton from './demo/DemoResetButton';

const IS_DEMO = process.env.REACT_APP_DEMO_MODE === 'true';

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
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const MCS_BASE = process.env.REACT_APP_MCS_URL || 'http://localhost:3003';

  const mcsUrl = useMemo(() => {
    const token = localStorage.getItem('token') || '';
    const userEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({
      id: user?.id,
      username: user?.username,
      role: user?.role,
    }))));
    return `${MCS_BASE}#token=${token}&user=${userEncoded}`;
  }, [user?.id, user?.username, user?.role, MCS_BASE]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [
      {
        label: 'Inventory',
        items: [
          { path: '/dashboard', label: 'DASHBOARD', icon: <Dashboard /> },
          { path: '/parts', label: 'PARTS', icon: <Inventory /> },
          { path: '/purchase-orders', label: 'PURCHASE ORDERS', icon: <ShoppingCart />, requiredPermission: 'CAN_MANAGE_PURCHASE_ORDERS' },
          { path: '/transactions', label: 'PARTS USAGE HISTORY', icon: <ReceiptLong />, requiredPermission: 'CAN_VIEW_TRANSACTIONS' },
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
          { href: mcsUrl, external: true, label: 'MAINTENANCE SYSTEM', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' },
        ],
      },
    ];

    if (hasPermission('CAN_VIEW_ALL')) {
      sections.push({
        label: 'Analytics',
        items: [
          { path: '/kpi-dashboard', label: 'KPI DASHBOARD', icon: <BarChart />, requiredPermission: 'CAN_VIEW_ALL' },
        ],
      });
    }

    return sections;
  }, [mcsUrl, hasPermission]);

  const isActive = (item: NavItem) =>
    !item.external && !!item.path && location.pathname.startsWith(item.path);

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
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ mr: 1, color: PRIMARY_ORANGE }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Inventory2 sx={{ color: PRIMARY_ORANGE, mr: 1 }} />
            <Typography
              variant="h6"
              fontWeight="bold"
              color={PRIMARY_ORANGE}
              sx={{ flexGrow: 1 }}
            >
              IMMS
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.400', mr: 2, display: { xs: 'none', sm: 'block' } }}>
              {user?.username}
            </Typography>
            {IS_DEMO && <DemoRoleSwitcher currentRole={user?.role ?? null} />}
            {IS_DEMO && user?.role === 'admin' && <DemoResetButton />}
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

        {/* ── Sidebar nav list (shared content) ─────────────────────── */}
        {(() => {
          const navContent = (
            <Box sx={{ pt: isMobile ? 0 : `${APPBAR_HEIGHT}px`, height: isMobile ? '100%' : `calc(100vh - ${APPBAR_HEIGHT}px)`, overflowY: 'auto', bgcolor: DARK_SURFACE }}>
              {navSections.map((section, si) => {
                const visibleItems = section.items.filter(
                  (item) => !item.requiredPermission || hasPermission(item.requiredPermission)
                );
                if (visibleItems.length === 0) return null;
                return (
                  <React.Fragment key={section.label}>
                    {si > 0 && (
                      <Divider sx={{ bgcolor: '#333', mx: 1, my: 0.5 }} />
                    )}
                    {(expanded || isMobile) && (
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
                            onClick={() => isMobile && setMobileOpen(false)}
                          >
                            <ListItemIcon sx={iconSx(active)}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              primaryTypographyProps={{
                                fontSize: '13px',
                                fontWeight: active ? 600 : 400,
                                color: active ? PRIMARY_ORANGE : '#CCCCCC',
                                noWrap: true,
                              }}
                              sx={{
                                overflow: 'hidden',
                                maxWidth: (expanded || isMobile) ? 'none' : 0,
                                opacity: (expanded || isMobile) ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                whiteSpace: 'nowrap',
                              }}
                            />
                            {item.external && (
                              <OpenInNew sx={{ fontSize: 12, color: '#666', ml: 0.5, display: (expanded || isMobile) ? 'block' : 'none' }} />
                            )}
                          </ListItem>
                        );
                        return (expanded || isMobile) ? listItem : (
                          <Tooltip key={item.label} title={item.label} placement="right">
                            {listItem}
                          </Tooltip>
                        );
                      })}
                    </List>
                  </React.Fragment>
                );
              })}
            </Box>
          );

          if (isMobile) {
            return (
              <SwipeableDrawer
                anchor="left"
                open={mobileOpen}
                onOpen={() => setMobileOpen(true)}
                onClose={() => setMobileOpen(false)}
                sx={{ '& .MuiDrawer-paper': { width: FULL_WIDTH, bgcolor: DARK_SURFACE, color: 'white' } }}
              >
                {navContent}
              </SwipeableDrawer>
            );
          }

          return (
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
                  position: 'fixed',
                  zIndex: (t) => t.zIndex.drawer,
                },
              }}
            >
              {navContent}
            </Drawer>
          );
        })()}

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            mt: `${APPBAR_HEIGHT}px`,
            ml: isMobile ? 0 : `${MINI_WIDTH}px`,
            bgcolor: 'background.default',
            minHeight: `calc(100vh - ${APPBAR_HEIGHT}px)`,
            overflow: 'auto',
          }}
        >
          {IS_DEMO && <DemoBanner />}
          <Box sx={{ p: 2 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Navigation;
