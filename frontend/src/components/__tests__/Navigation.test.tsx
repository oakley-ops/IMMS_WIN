import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

const adminAuthContext = {
  user: { id: 1, username: 'admin', name: 'Admin User', role: 'ADMIN' },
  logout: jest.fn(),
  hasPermission: () => true,
  isAuthenticated: true,
  loading: false,
  userRole: 'ADMIN',
};

const unauthContext = {
  user: null,
  logout: jest.fn(),
  hasPermission: () => false,
  isAuthenticated: false,
  loading: false,
  userRole: null,
};

const renderNav = () =>
  render(
    <BrowserRouter>
      <Navigation><div>content</div></Navigation>
    </BrowserRouter>
  );

describe('Navigation Component', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(adminAuthContext);
  });

  test('renders AppBar with IMMS brand name', () => {
    renderNav();
    expect(screen.getAllByText('IMMS').length).toBeGreaterThanOrEqual(1);
  });

  test('renders navigation links', () => {
    renderNav();
    expect(screen.getByText(/PARTS/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/MACHINES/i)).toBeInTheDocument();
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  test('"MAINTENANCE SYSTEM" renders as an external anchor with target="_blank"', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('"MAINTENANCE SYSTEM" href points to MCS base URL with token fragment', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    const href = link?.getAttribute('href') ?? '';
    expect(href).toMatch(/localhost:3003/);
    expect(href).toContain('#token=');
    expect(href).toContain('&user=');
  });

  test('"MAINTENANCE SYSTEM" is hidden when user has no permissions', () => {
    mockUseAuth.mockReturnValue(unauthContext);
    renderNav();
    expect(screen.queryByText(/MAINTENANCE SYSTEM/i)).not.toBeInTheDocument();
  });

  test('"MAINTENANCE CALLS" internal route is not in the nav', () => {
    renderNav();
    expect(screen.queryByText(/^MAINTENANCE CALLS$/i)).not.toBeInTheDocument();
  });

  test('renders username in AppBar', () => {
    renderNav();
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });
});
