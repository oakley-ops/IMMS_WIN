'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// IMMS is the auth authority. MCS no longer owns a login form; instead it
// redirects unauthenticated users to IMMS and accepts the token back via a
// URL fragment (#token=<jwt>&user=<base64-json>).
const IMMS_LOGIN_URL =
  process.env.NEXT_PUBLIC_IMMS_LOGIN_URL || 'http://localhost:3000/login';

interface User {
  id: number;
  username: string;
  role: string;
}
interface AuthCtx {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  redirectToLogin: () => void;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

const consumeAuthFragment = (): { token: string; user: User } | null => {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('token');
  const userEncoded = params.get('user');
  if (!token || !userEncoded) return null;
  try {
    const user = JSON.parse(atob(userEncoded)) as User;
    // Scrub the fragment so the token doesn't sit in browser history.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return { token, user };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fromFragment = consumeAuthFragment();
    if (fromFragment) {
      localStorage.setItem('mcs_token', fromFragment.token);
      localStorage.setItem('mcs_user', JSON.stringify(fromFragment.user));
      setToken(fromFragment.token);
      setUser(fromFragment.user);
      setIsLoading(false);
      return;
    }

    const storedToken = localStorage.getItem('mcs_token');
    const storedUser = localStorage.getItem('mcs_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mcs_token');
    localStorage.removeItem('mcs_user');
    setToken(null);
    setUser(null);
  }, []);

  const redirectToLogin = useCallback(() => {
    const returnTo = window.location.href;
    window.location.href = `${IMMS_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated: !!token, logout, redirectToLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
