// Mock axios before imports
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({
      data: {
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
      }
    })),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  }))
}));

import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Dashboard from '../../pages/Dashboard';
import { BrowserRouter } from 'react-router-dom';

const mockAxios = axios.create();

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

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  let mockEventSource: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios response
    (mockAxios.get as jest.Mock).mockResolvedValue({ data: mockDashboardData });
    
    // Mock EventSource
    mockEventSource = {
      messageCallback: null,
      addEventListener: jest.fn((event: string, callback: (event: any) => void) => {
        if (event === 'message') {
          mockEventSource.messageCallback = callback;
        }
      }),
      close: jest.fn()
    };
    
    (global as any).EventSource = jest.fn(() => mockEventSource);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders dashboard with initial data', async () => {
    renderWithRouter(<Dashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
      expect(screen.getByTestId('low-stock-count')).toHaveTextContent('5');
      expect(screen.getByTestId('out-of-stock-count')).toHaveTextContent('2');
    });

    // Check low stock list
    const lowStockTable = screen.getAllByRole('table')[0]; // First table is low stock
    const lowStockPart = within(lowStockTable).getByText('Part 1');
    expect(lowStockPart).toBeInTheDocument();
    
    // Check recent usage history
    expect(screen.getByTestId('part-name-Part 1')).toBeInTheDocument();
    expect(screen.getByTestId('machine-name-Machine 1')).toBeInTheDocument();
  });

  it('handles real-time updates via EventSource', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Simulate receiving a real-time update
    const updatedData = {
      ...mockDashboardData,
      totalParts: 150,
      lowStockCount: 6
    };

    expect(mockEventSource.messageCallback).toBeDefined();

    // Simulate receiving an event
    await act(async () => {
      mockEventSource.messageCallback({ data: JSON.stringify(updatedData) });
    });

    // Check if the UI updates with new data
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('150');
      expect(screen.getByTestId('low-stock-count')).toHaveTextContent('6');
    });
  });

  it('handles error states', async () => {
    const errorMessage = "Cannot read properties of undefined (reading 'data')";
    (mockAxios.get as jest.Mock).mockRejectedValueOnce(new TypeError(errorMessage));
    
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(`TypeError: ${errorMessage}`);
    });

    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Mock successful response for retry
    (mockAxios.get as jest.Mock).mockResolvedValueOnce({ data: mockDashboardData });

    await userEvent.click(retryButton);

    // Verify data loads after retry
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
    });
  });
});
