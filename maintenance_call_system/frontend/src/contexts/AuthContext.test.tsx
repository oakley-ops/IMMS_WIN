import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('axios');

const Consumer = () => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  if (isLoading) return <span>loading</span>;
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'authed' : 'guest'}</span>
      <span data-testid="user">{user?.username ?? 'none'}</span>
      <button onClick={() => login('admin', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts as unauthenticated when no token is in storage', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('restores the session from localStorage on mount', async () => {
    localStorage.setItem('mcs_token', 'stored-token');
    localStorage.setItem('mcs_user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'));
    expect(screen.getByTestId('user')).toHaveTextContent('admin');
  });

  it('becomes authenticated after a successful login()', async () => {
    (axios.post as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockResolvedValue({
      data: { token: 'fresh-token', user: { id: 2, username: 'tech', role: 'technician' } },
    });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'));
    await act(async () => {
      fireEvent.click(screen.getByText('Login'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authed');
    expect(screen.getByTestId('user')).toHaveTextContent('tech');
    expect(localStorage.getItem('mcs_token')).toBe('fresh-token');
  });

  it('clears token, user, and localStorage on logout()', async () => {
    localStorage.setItem('mcs_token', 'stored-token');
    localStorage.setItem('mcs_user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'));

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('guest');
    expect(localStorage.getItem('mcs_token')).toBeNull();
    expect(localStorage.getItem('mcs_user')).toBeNull();
  });
});
