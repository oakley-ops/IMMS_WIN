import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { getBadges, getReaders, getMachines } = vi.hoisted(() => ({
  getBadges: vi.fn(),
  getReaders: vi.fn(),
  getMachines: vi.fn(),
}));

vi.mock('../services/maintenanceCallService', () => ({
  default: { getBadges, getReaders, getMachines },
}));

import BadgeAdmin from './BadgeAdmin';

beforeEach(() => {
  vi.clearAllMocks();
  getBadges.mockResolvedValue([]);
  getReaders.mockResolvedValue([]);
  getMachines.mockResolvedValue([]);
});

describe('BadgeAdmin', () => {
  it('renders Badges and Readers tabs', async () => {
    render(<BadgeAdmin />);
    expect(await screen.findByRole('tab', { name: /Badges/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Readers/i })).toBeInTheDocument();
  });

  it('calls getBadges, getReaders, and getMachines on mount', async () => {
    render(<BadgeAdmin />);
    await waitFor(() => {
      expect(getBadges).toHaveBeenCalledTimes(1);
      expect(getReaders).toHaveBeenCalledTimes(1);
      expect(getMachines).toHaveBeenCalledTimes(1);
    });
  });

  it('displays registered badges in the Badges tab', async () => {
    getBadges.mockResolvedValueOnce([
      { badge_id: 'B001', person_name: 'Alice Smith', role: 'operator', technician_id: null, active: true },
    ]);
    render(<BadgeAdmin />);
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('B001')).toBeInTheDocument();
  });

  it('station URL in Readers tab uses /station?reader= not /maintenance-call/station', async () => {
    getReaders.mockResolvedValueOnce([
      { reader_id: 1, reader_key: 'press-1', machine_id: 1, machine_name: 'Press 701', location_label: 'Bay 1', active: true },
    ]);
    render(<BadgeAdmin />);
    // Switch to Readers tab
    const readersTab = await screen.findByRole('tab', { name: /Readers/i });
    await userEvent.click(readersTab);
    await waitFor(() => {
      expect(screen.getByText(/\/station\?reader=press-1/i)).toBeInTheDocument();
      expect(screen.queryByText(/maintenance-call\/station/i)).not.toBeInTheDocument();
    });
  });
});
