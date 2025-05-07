import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { AuthProvider } from '../../contexts/AuthContext';

describe('Navigation Component', () => {
  const renderWithRouter = (component: React.ReactNode) => {
    return render(
      <AuthProvider>
        <BrowserRouter>{component}</BrowserRouter>
      </AuthProvider>
    );
  };

  test('renders navigation links', () => {
    renderWithRouter(
      <Navigation>
        <div>Test Content</div>
      </Navigation>
    );
    
    // Check for main navigation links
    expect(screen.getByText(/PARTS/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSACTIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/MACHINES/i)).toBeInTheDocument();
    expect(screen.getByText(/DASHBOARD/i)).toBeInTheDocument();
  });

  test('renders brand name', () => {
    renderWithRouter(
      <Navigation>
        <div>Test Content</div>
      </Navigation>
    );
    
    // Check for the brand name
    expect(screen.getByText(/Tech Inventory/i)).toBeInTheDocument();
  });
});
