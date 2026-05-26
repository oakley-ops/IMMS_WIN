'use client';
import React from 'react';
import Link from 'next/link';
import {
  Box, AppBar, Toolbar, Typography, Button, Drawer,
  List, ListItem, ListItemIcon, ListItemText, IconButton,
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
      ? [{ label: 'Admin', href: '/admin', icon: <Settings /> } satisfies NavItem]
      : [] as NavItem[]),
  ];

  return (
    <Box display="flex" minHeight="100vh">
      <AppBar position="fixed" sx={{ bgcolor: DARK_BG, zIndex: t => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" aria-label="menu" onClick={() => setOpen(o => !o)} sx={{ mr: 2 }}>
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
