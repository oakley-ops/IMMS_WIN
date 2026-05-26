import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  ThemeProvider,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  CssBaseline,
} from '@mui/material';
import {
  AccountCircle,
  Logout,
  Menu as MenuIcon,
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
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { theme, IMMS_ORANGE } from '../theme';

const IMMS_BLUE = '#0066A1';
const DRAWER_WIDTH = 240;

interface NavigationProps {
  children: React.ReactNode;
}

interface NavigationItem {
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

  const MCS_BASE = process.env.REACT_APP_MCS_URL || 'http://localhost:3003';
  const buildMCSUrl = (): string => {
    const token = localStorage.getItem('token') || '';
    // Use encodeURIComponent-safe btoa to handle non-ASCII usernames/roles
    const userEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({
      id: user?.id,
      username: user?.username,
      role: user?.role,
    }))));
    return `${MCS_BASE}#token=${token}&user=${userEncoded}`;
  };

  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigationItems: NavigationItem[] = [
    { path: '/', label: 'DASHBOARD', icon: <Dashboard /> },
    { path: '/parts', label: 'PARTS', icon: <Inventory /> },
    { path: '/purchase-orders', label: 'PURCHASE ORDERS', icon: <ShoppingCart />, requiredPermission: 'CAN_MANAGE_PURCHASE_ORDERS' },
    { path: '/transactions', label: 'TRANSACTIONS', icon: <ReceiptLong />, requiredPermission: 'CAN_VIEW_TRANSACTIONS' },
    { path: '/machines', label: 'MACHINES', icon: <Build />, requiredPermission: 'CAN_VIEW_MACHINES' },
    { path: '/work-orders', label: 'WORK ORDERS', icon: <Engineering />, requiredPermission: 'CAN_VIEW_MACHINES' },
    { path: '/pm-checklists', label: 'PM MANAGEMENT', icon: <PlaylistAddCheck />, requiredPermission: 'CAN_MANAGE_PM_CHECKLISTS' },
    { path: '/projects', label: 'PROJECTS', icon: <Assignment />, requiredPermission: 'CAN_MANAGE_PROJECTS' },
    { path: '/die-tracker', label: 'DIE MANAGEMENT', icon: <Category />, requiredPermission: 'CAN_VIEW_MACHINES' },
    { path: '/contacts', label: 'CONTACTS', icon: <ContactsIcon />, requiredPermission: 'CAN_VIEW_CONTACTS' },
    { path: '/technicians', label: 'TECHNICIANS', icon: <People />, requiredPermission: 'CAN_MANAGE_USERS' },
    { href: buildMCSUrl(), external: true, label: 'MAINTENANCE SYSTEM', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' },
  ];

  if (hasPermission('CAN_VIEW_ALL')) {
    navigationItems.push({ 
      path: '/kpi-dashboard', 
      label: 'KPI DASHBOARD', 
      icon: <BarChart />, 
      requiredPermission: 'CAN_VIEW_ALL' 
    });
  }

  const filteredNavigationItems = navigationItems.filter(item => {
    if (!item.requiredPermission) return true;
    return hasPermission(item.requiredPermission);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const drawer = (
    <Box sx={{
      width: DRAWER_WIDTH,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: IMMS_BLUE,
      color: 'white'
    }}>
      <Box sx={{ p: 2, textAlign: 'left' }}>
        <Typography
          variant="h6"
          sx={{
            color: IMMS_ORANGE,
            fontWeight: 'bold',
            textDecoration: 'none',
            fontSize: '1.3rem',
            mb: 0.5,
            display: 'flex',
            alignItems: 'flex-bottom',
            '&:hover': {
              opacity: 0.9,
              cursor: 'pointer'
            }
          }}
          component={Link}
          to="/"
          onClick={() => setDrawerOpen(false)}
        >
          IMMS
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.9rem' }}>
          {user?.name} ({user?.role?.toUpperCase()})
        </Typography>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }} />
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {filteredNavigationItems.map(({ path, href, external, label, icon }) => (
          <ListItem
            button
            key={label}
            component={external ? 'a' : Link}
            {...(external
              ? { href, target: '_blank', rel: 'noopener noreferrer' }
              : { to: path ?? '/' }
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
      </List>
      <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }} />
      <List>
        <ListItem button onClick={handleLogout}>
          <ListItemIcon sx={{ color: 'white', minWidth: 40 }}><Logout /></ListItemIcon>
          <ListItemText 
            primary="Logout" 
            sx={{ 
              '& .MuiListItemText-primary': { 
                fontSize: '0.9rem'
              } 
            }}
          />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', maxWidth: '100vw', overflow: 'hidden' }}>
        <CssBaseline />

        {/* Hamburger Menu Button - Always visible */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            left: 8,
            top: 8,
            zIndex: 1300,
            bgcolor: IMMS_BLUE,
            color: 'white',
            width: 40,
            height: 40,
            '&:hover': {
              bgcolor: 'rgba(0, 102, 161, 0.9)',
            }
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Temporary Drawer - Opens on hamburger click */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: 'none'
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 2,
            pt: 7,
            width: '100%',
            maxWidth: '100%',
            bgcolor: '#f5f5f5',
            overflow: 'auto'
          }}
        >
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Navigation;
