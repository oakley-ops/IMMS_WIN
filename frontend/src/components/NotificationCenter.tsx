// src/components/NotificationCenter.tsx
import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import { API_URL } from '../config';

interface Notification {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error';
    timestamp: Date;
    isRead: boolean;
  }
  
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
  
    return (
      <div>
        <button onClick={() => setShowNotifications(!showNotifications)}>
          Notifications
        </button>
        {showNotifications && (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className={notification.isRead ? 'read' : ''}>
                {notification.message}
                <button onClick={() => markNotificationAsRead(notification.id)}>
                  Mark as read
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  
  export default NotificationCenter;