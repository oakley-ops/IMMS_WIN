import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthProvider } from '../../contexts/AuthContext';
import mockAxios from '../../__mocks__/axios';

const mockDashboardData = {
  totalParts: 100,
  lowStockCount: 5,
  outOfStockCount: 2,
  totalMachines: 10,
  allParts: [],
  lowStockParts: [
    {
      id: 1,
      name: 'Part 1',
      quantity: 3,
      minimum_quantity: 5,
      location: 'A1',
      status: 'active'
    }
  ],
  recentUsage: [
    {
      id: 1,
      date: '2023-01-01',
      partName: 'Part 1',
      machine: 'Machine 1',
      quantity: 5,
      type: 'usage'
    }
  ],
  recentUsageHistory: [
    {
      date: '2023-01-01',
      part_name: 'Part 1',
      machine_name: 'Machine 1',
      quantity: 5,
      type: 'usage'
    }
  ],
  usageTrends: [],
  topUsedParts: []
};

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <AuthProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthProvider>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockResolvedValue({ data: mockDashboardData });
  });

  it('renders dashboard with initial data', async () => {
    renderWithProviders(<Dashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
      expect(screen.getByTestId('low-stock-count')).toHaveTextContent('5');
      expect(screen.getByTestId('out-of-stock-count')).toHaveTextContent('2');
    });

    // Check low stock list
    expect(screen.getByRole('cell', { name: 'Part 1' })).toBeInTheDocument();
    
    // Check recent usage history
    expect(screen.getByTestId('part-name-Part 1')).toBeInTheDocument();
    expect(screen.getByTestId('machine-name-Machine 1')).toBeInTheDocument();
  });

  it('handles error states', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Failed to fetch data'));
    
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });
}); 