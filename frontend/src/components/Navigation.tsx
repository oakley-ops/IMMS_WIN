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
  useMediaQuery,
  useTheme,
  IconButton,
  CssBaseline,
  Menu,
  MenuItem,
} from '@mui/material';
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
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { theme, FISERV_ORANGE } from '../theme';

const FISERV_BLUE = '#0066A1';
const DRAWER_WIDTH = 240;

interface NavigationProps {
  children: React.ReactNode;
}

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: string;
}

const Navigation: React.FC<NavigationProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, hasPermission } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const muiTheme = useTheme();
  const isCompact = useMediaQuery(muiTheme.breakpoints.down('lg'));

  const navigationItems: NavigationItem[] = [
    { path: '/', label: 'DASHBOARD', icon: <Dashboard /> },
    { path: '/parts', label: 'PARTS', icon: <Inventory /> },
    { path: '/machines', label: 'MACHINES', icon: <Build />, requiredPermission: 'CAN_VIEW_ALL' },
    { path: '/machine-costs', label: 'MACHINE COSTS', icon: <MonetizationOn />, requiredPermission: 'CAN_VIEW_ALL' },
    { path: '/transactions', label: 'TRANSACTIONS', icon: <ReceiptLong />, requiredPermission: 'CAN_VIEW_TRANSACTIONS' },
    { path: '/purchase-orders', label: 'PURCHASE ORDERS', icon: <ShoppingCart />, requiredPermission: 'CAN_MANAGE_PURCHASE_ORDERS' },
    { path: '/projects', label: 'PROJECTS', icon: <Assignment />, requiredPermission: 'CAN_MANAGE_PROJECTS' },
  ];

  if (hasPermission('CAN_MANAGE_USERS')) {
    navigationItems.push({ 
      path: '/users', 
      label: 'USER MANAGEMENT', 
      icon: <People />, 
      requiredPermission: 'CAN_MANAGE_USERS' 
    });
  }

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
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ 
      width: DRAWER_WIDTH,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: FISERV_BLUE,
      color: 'white'
    }}>
      <Box sx={{ p: 2, textAlign: 'left' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            color: FISERV_ORANGE, 
            fontWeight: 'bold',
            textDecoration: 'none',
            fontSize: '1.3rem',
            mb: 0.5,
            paddingLeft: isCompact ? '48px' : '0',
            '&:hover': {
              opacity: 0.9,
              cursor: 'pointer'
            }
          }}
          component={Link}
          to="/"
        >
          Tech Inventory
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.9rem', paddingLeft: isCompact ? '48px' : '0' }}>
          {user?.name} ({user?.role?.toUpperCase()})
        </Typography>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }} />
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {filteredNavigationItems.map(({ path, label, icon }) => (
          <ListItem 
            button 
            key={path} 
            component={Link} 
            to={path}
            selected={location.pathname === path}
            sx={{
              py: 1.5,
              bgcolor: location.pathname === path ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              }
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>{icon}</ListItemIcon>
            <ListItemText 
              primary={label} 
              sx={{ 
                '& .MuiListItemText-primary': { 
                  fontSize: '0.9rem',
                  fontWeight: location.pathname === path ? 'bold' : 'normal'
                } 
              }} 
            />
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
        {isCompact && (
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
              bgcolor: FISERV_BLUE,
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
        )}
        
        <Box sx={{ 
          width: { lg: DRAWER_WIDTH }, 
          flexShrink: { lg: 0 },
          display: { xs: isCompact ? 'none' : 'block' }
        }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', lg: 'none' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: DRAWER_WIDTH,
                borderRight: 'none'
              },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', lg: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: DRAWER_WIDTH,
                borderRight: 'none'
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
        
        <Box
          component="main"
          sx={{ 
            flexGrow: 1, 
            p: isCompact ? 1 : 3,
            pt: isCompact ? 7 : 3,
            width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
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
