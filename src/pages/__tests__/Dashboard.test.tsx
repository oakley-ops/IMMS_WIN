import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthProvider } from '../../contexts/AuthContext';
import axiosInstance from '../../services/axiosInstance';

// Mock axios
jest.mock('../../services/axiosInstance', () => ({
  get: jest.fn()
}));

const mockDashboardData = {
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
  let messageCallback: ((event: any) => void) | null = null;
  const mockEventSource = {
    addEventListener: jest.fn((event, callback) => {
      if (event === 'message') {
        messageCallback = callback;
      }
    }),
    removeEventListener: jest.fn(),
    close: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messageCallback = null;
    (axiosInstance.get as jest.Mock).mockResolvedValue(mockDashboardData);
    // Mock EventSource constructor
    (global as any).EventSource = jest.fn(() => mockEventSource);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders dashboard with initial data', async () => {
    renderWithProviders(<Dashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
      expect(screen.getByTestId('low-stock-count')).toHaveTextContent('5');
      expect(screen.getByTestId('out-of-stock-count')).toHaveTextContent('2');
    });

    // Find the Inventory Status Alerts section
    const lowStockSection = screen.getByText('Inventory Status Alerts').closest('.card');
    expect(lowStockSection).toBeInTheDocument();

    // Find the table within the section and verify its contents
    const table = within(lowStockSection!).getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // Header + at least one data row
    
    // Get the first data row and verify its content
    const firstDataRow = rows[1];
    const firstRowCells = within(firstDataRow).getAllByRole('cell');
    expect(firstRowCells[0]).toHaveTextContent('Part 1');
    
    // Check recent usage history
    const recentUsageSection = screen.getByText('Recent Usage History').closest('.card');
    expect(recentUsageSection).toBeInTheDocument();
    
    const usageTable = within(recentUsageSection!).getByRole('table');
    const usageRows = within(usageTable).getAllByRole('row');
    expect(usageRows.length).toBeGreaterThan(1);
    
    // Get the first usage row and verify its content
    const firstUsageRow = usageRows[1];
    const usageCells = within(firstUsageRow).getAllByRole('cell');
    expect(usageCells[1]).toHaveTextContent('Part 1');
    expect(usageCells[2]).toHaveTextContent('Machine 1');
  });

  it('handles error states', async () => {
    // Mock the error response
    (axiosInstance.get as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch data'));
    
    renderWithProviders(<Dashboard />);

    // Wait for the error state
    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Error: Failed to fetch data');
    });

    // Mock successful response for retry
    (axiosInstance.get as jest.Mock).mockResolvedValueOnce(mockDashboardData);

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    retryButton.click();

    // Verify that the retry functionality works
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
    });
  });

  it('handles real-time updates via EventSource', async () => {
    renderWithProviders(<Dashboard />);

    // Initial data should be loaded
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('100');
    });

    const updatedData = {
      ...mockDashboardData.data,
      totalParts: 150,
      lowStockCount: 8
    };

    // Simulate receiving an event
    await act(async () => {
      if (messageCallback) {
        messageCallback({ data: JSON.stringify(updatedData) });
      }
    });

    // Check if the UI updates with new data
    await waitFor(() => {
      expect(screen.getByTestId('total-parts')).toHaveTextContent('150');
      expect(screen.getByTestId('low-stock-count')).toHaveTextContent('8');
    });
  });
}); 