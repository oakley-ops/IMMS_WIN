import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { AuthProvider } from '../../contexts/AuthContext';

const renderNav = () =>
  render(
    <AuthProvider>
      <BrowserRouter>
        <Navigation><div>content</div></Navigation>
      </BrowserRouter>
    </AuthProvider>
  );

describe('Navigation Component', () => {
  test('renders navigation links', () => {
    renderNav();
    expect(screen.getByText(/PARTS/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/MACHINES/i)).toBeInTheDocument();
    expect(screen.getByText(/DASHBOARD/i)).toBeInTheDocument();
  });

  test('renders brand name', () => {
    renderNav();
    expect(screen.getByText(/IMMS/i)).toBeInTheDocument();
  });

  test('"MAINTENANCE CALLS" internal route is no longer in the nav', () => {
    renderNav();
    expect(screen.queryByText(/^MAINTENANCE CALLS$/i)).not.toBeInTheDocument();
  });

  test('"MAINTENANCE SYSTEM" renders as an external anchor with target="_blank"', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('"MAINTENANCE SYSTEM" href points to the MCS base URL', () => {
    renderNav();
    const link = screen.getByText(/MAINTENANCE SYSTEM/i).closest('a');
    const href = link?.getAttribute('href') ?? '';
    expect(href).toMatch(/localhost:3003/);
    expect(href).toContain('#token=');
    expect(href).toContain('&user=');
  });
});
