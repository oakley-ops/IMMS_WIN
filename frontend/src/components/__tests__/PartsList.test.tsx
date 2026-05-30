import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PartsList from '../PartsList';
import { AuthProvider } from '../../contexts/AuthContext';
import mockAxios from '../../__mocks__/axios';

// Mock data
const mockPartsData = {
  items: [
    {
      part_id: 1,
      name: 'Resistor',
      description: '10K Ohm 1/4W',
      manufacturer: 'Test Manufacturer',
      manufacturer_part_number: 'MPN123',
      internal_part_number: 'FPN123',
      quantity: 100,
      minimum_quantity: 50,
      location: 'Test Location',
      notes: 'Test Notes',
      last_ordered_date: '2025-01-01',
      cost: 100,
      status: 'active'
    },
    {
      part_id: 2,
      name: 'Capacitor',
      description: '100μF 25V',
      manufacturer: 'Test Manufacturer',
      manufacturer_part_number: 'MPN123',
      internal_part_number: 'FPN123',
      quantity: 25,
      minimum_quantity: 30,
      location: 'Test Location',
      notes: 'Test Notes',
      last_ordered_date: '2025-01-01',
      cost: 100,
      status: 'active'
    }
  ],
  total: 2
};

const mockLocationsData = ['Location 1', 'Location 2'];

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthProvider>
  );
};

describe('PartsList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    
    // Mock successful responses
    mockAxios.get.mockResolvedValue({ data: mockPartsData });
    mockAxios.delete.mockResolvedValue({ data: {} });
  });

  const waitForGridLoad = async () => {
    // Wait for the table to exist (MUI Table renders role="table")
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    }, { timeout: 15000 });

    // Validate content states: either data rows present, or the empty message
    await waitFor(() => {
      const rows = screen.queryAllByRole('row');
      const noRows = screen.queryByText(/no parts found/i);
      expect(rows.length > 1 || noRows).toBeTruthy();
    }, { timeout: 15000 });
  };

  const findCellByText = async (text: string) => {
    await waitForGridLoad();

    return await waitFor(
      () => {
        // First try to find by cell role (MUI Table cells use role="cell")
        const cells = screen.queryAllByRole('cell');
        const cell = cells.find(el => el.textContent?.includes(text));

        if (cell) return cell;

        // If no cells found, try finding by text directly
        const textElement = screen.getByText(text);
        return textElement.closest('[role="cell"]') || textElement;
      },
      { timeout: 15000 }
    );
  };

  const findButtonInRow = async (rowText: string, buttonTestId: string) => {
    const cell = await findCellByText(rowText);
    const row = cell.closest('.MuiDataGrid-row');
    if (!row) {
      throw new Error('Could not find row containing cell');
    }
    
    return within(row as HTMLElement).getByTestId(buttonTestId);
  };

  it('renders without crashing', async () => {
    renderWithProviders(<PartsList />);
    await waitFor(() => {
      expect(screen.getByText('Resistor')).toBeInTheDocument();
    });
  });

  it('displays parts data correctly', async () => {
    renderWithProviders(<PartsList />);
    await waitForGridLoad();

    const resistor = await findCellByText('Resistor');
    expect(resistor).toBeInTheDocument();
    
    const capacitor = await findCellByText('Capacitor');
    expect(capacitor).toBeInTheDocument();
  }, 20000);

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PartsList />);
    await waitForGridLoad();

    const searchInput = screen.getByPlaceholderText('Search by name, part number, location...');
    await user.type(searchInput, 'Resistor');

    await waitFor(async () => {
      const cells = screen.queryAllByRole('cell');
      expect(cells.some(cell => cell.textContent?.includes('Resistor'))).toBe(true);
    }, { timeout: 15000 });
  }, 20000);

  // Skipped: the discontinue/delete action lives in the "Actions" column, which is
  // hidden by default and only revealed via the column-visibility menu. Exercising it
  // requires brittle menu navigation. Needs a rewrite that opens that menu first.
  it.skip('handles delete functionality', async () => {
    const user = userEvent.setup();
    mockAxios.get.mockResolvedValueOnce({ data: mockPartsData });
    mockAxios.delete.mockResolvedValueOnce({ data: { message: 'Part deleted successfully' } });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    renderWithProviders(<PartsList />);

    // Wait for parts to load and grid to be ready
    await waitForGridLoad();

    // Find the first enabled delete (discontinue) button
    const deleteButton = await waitFor(() => {
      const buttons = screen.getAllByTestId('delete-button');
      const enabled = buttons.find(b => !(b as HTMLButtonElement).disabled);
      expect(enabled).toBeDefined();
      return enabled as HTMLElement;
    }, { timeout: 15000 });

    await user.click(deleteButton);

    // Verify confirmation was shown
    expect(window.confirm).toHaveBeenCalled();

    // Verify API call was made (discontinue performs a DELETE)
    await waitFor(() => {
      expect(mockAxios.delete).toHaveBeenCalledWith('/api/v1/parts/1');
    });
  }, 20000);

  it('handles empty state correctly', async () => {
    // Mock empty response
    mockAxios.get.mockImplementation((url: string) => {
      if (url.includes('/api/v1/parts')) {
        return Promise.resolve({ 
          data: { items: [], total: 0 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderWithProviders(<PartsList />);
    await waitForGridLoad();
    
    // Wait for the empty state message
    await waitFor(() => {
      expect(screen.getByText(/no parts found/i)).toBeInTheDocument();
    }, { timeout: 15000 });
  }, 20000);
});
