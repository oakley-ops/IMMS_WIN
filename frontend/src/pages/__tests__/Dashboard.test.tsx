import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  outOfStockParts: [],
  lowStockParts: [
    {
      id: 1,
      part_id: 1,
      name: 'Part 1',
      quantity: 3,
      minimum_quantity: 5,
      location: 'A1',
      status: 'active'
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

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockResolvedValue({ data: mockDashboardData });
  });

  it('renders the inventory status section once data loads', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Inventory Status Alerts')).toBeInTheDocument();
    });
  });

  it('shows an error alert with a retry button when the request fails', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Failed to fetch data'));

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch data/);
    });

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    mockAxios.get.mockResolvedValueOnce({ data: mockDashboardData });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Inventory Status Alerts')).toBeInTheDocument();
    });
  });
});
