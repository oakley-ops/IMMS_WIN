import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../utils/axios';
import { hasPermission, getPermissionsForRole } from '../utils/permissions';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get the user's role as a convenience property
  const userRole = user?.role || null;

  useEffect(() => {
    // Add event listener for when the window is closed or refreshed
    const handleUnload = () => {
      localStorage.removeItem('token');
    };

    window.addEventListener('beforeunload', handleUnload);
    
    checkAuthStatus();

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await axios.get('/api/v1/auth/verify');
        setUser(response.data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/v1/auth/login', { username, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await axios.post('/api/v1/auth/change-password', {
        currentPassword,
        newPassword
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      throw new Error(error.response?.data?.message || 'Failed to change password');
    }
  };

  // Permission check function that uses the hasPermission utility
  const checkPermission = (permission: string): boolean => {
    return hasPermission(userRole || undefined, permission);
  };

  // Set up axios interceptor for token expiration
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      login, 
      logout: handleLogout, 
      loading,
      changePassword,
      hasPermission: checkPermission,
      userRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 