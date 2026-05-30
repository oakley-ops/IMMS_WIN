import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import mockAxios from '../../__mocks__/axios';

const RoleProbe: React.FC = () => {
  const { userRole, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="role">{userRole ?? 'none'}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
    </div>
  );
};

describe('AuthContext session restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('resolves userRole from the nested verify response on session restore', async () => {
    localStorage.setItem('token', 'fake-token');
    // GET /api/v1/auth/verify returns { user: {...} }
    mockAxios.get.mockResolvedValue({
      data: { user: { id: 7, username: 'admin_test', name: 'Admin', role: 'admin' } }
    });

    render(
      <AuthProvider>
        <RoleProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
    });
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });
});
