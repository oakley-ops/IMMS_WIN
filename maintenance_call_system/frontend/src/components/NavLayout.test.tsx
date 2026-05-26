import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock Next.js Link so it renders as a plain <a> in tests
vi.mock('next/link', () => ({
  default: ({ href, children, target, rel }: {
    href: string; children: React.ReactNode; target?: string; rel?: string;
  }) => <a href={href} target={target} rel={rel}>{children}</a>,
}));

// Mock AuthContext so we control the user
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import NavLayout from './NavLayout';
import { useAuth } from '../contexts/AuthContext';

const mockUseAuth = vi.mocked(useAuth);

const techUser = { user: { id: 1, username: 'tech', role: 'tech' }, token: 'tok', isLoading: false, isAuthenticated: true, logout: vi.fn(), redirectToLogin: vi.fn() };
const adminUser = { user: { id: 2, username: 'admin', role: 'admin' }, token: 'tok', isLoading: false, isAuthenticated: true, logout: vi.fn(), redirectToLogin: vi.fn() };

describe('NavLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(techUser);
  });

  it('Live Board link has target="_blank"', async () => {
    const user = userEvent.setup();
    render(<NavLayout><div /></NavLayout>);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const link = screen.getByText('Live Board').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('Admin nav item is visible for admin role', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(adminUser);
    render(<NavLayout><div /></NavLayout>);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('Admin nav item is hidden for non-admin roles', async () => {
    const user = userEvent.setup();
    render(<NavLayout><div /></NavLayout>);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('does not render "Open Board in New Tab" footer link', async () => {
    const user = userEvent.setup();
    render(<NavLayout><div /></NavLayout>);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByText(/Open Board in New Tab/i)).not.toBeInTheDocument();
  });
});
