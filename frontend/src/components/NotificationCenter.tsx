// src/components/NotificationCenter.tsx
import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  Collapse,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
} from '@mui/icons-material';
import { API_URL } from '../config';
import {
  COLOR_SUCCESS_BG,
  COLOR_SUCCESS_TEXT,
  COLOR_ERROR_BG,
  COLOR_ERROR_TEXT,
  COLOR_WARNING_BG,
  COLOR_WARNING_TEXT,
} from '../theme';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: Date;
  isRead: boolean;
}

const typeStyles: Record<Notification['type'], { bg: string; color: string }> = {
  info: { bg: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT },
  warning: { bg: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT },
  error: { bg: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT },
};

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const storedNotifications = localStorage.getItem('notifications');
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications));
    }
  }, []);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('notification', (notification) => {
      addNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications((prevNotifications) => [
      ...prevNotifications,
      notification,
    ]);
    localStorage.setItem('notifications', JSON.stringify(notifications));
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <Button
        variant="outlined"
        startIcon={unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        onClick={() => setShowNotifications(!showNotifications)}
        endIcon={
          unreadCount > 0 ? (
            <Chip
              label={unreadCount}
              size="small"
              color="error"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          ) : undefined
        }
      >
        Notifications
      </Button>

      <Collapse in={showNotifications}>
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            right: 0,
            mt: 1,
            minWidth: 300,
            maxWidth: 400,
            zIndex: 1200,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {notifications.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                No notifications
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    backgroundColor: notification.isRead
                      ? 'background.paper'
                      : typeStyles[notification.type]?.bg ?? 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    alignItems: 'flex-start',
                  }}
                  secondaryAction={
                    !notification.isRead ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => markNotificationAsRead(notification.id)}
                        sx={{ fontSize: '0.7rem', minWidth: 'unset', px: 1 }}
                      >
                        Mark read
                      </Button>
                    ) : undefined
                  }
                >
                  <ListItemText
                    primary={notification.message}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: notification.isRead ? 400 : 600,
                      color: notification.isRead
                        ? 'text.primary'
                        : typeStyles[notification.type]?.color ?? 'text.primary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
};

export default NotificationCenter;
