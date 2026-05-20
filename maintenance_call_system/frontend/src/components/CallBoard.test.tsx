import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

const { getBoardStatus } = vi.hoisted(() => ({ getBoardStatus: vi.fn() }));
vi.mock('../services/maintenanceCallService', () => ({
  default: { getBoardStatus },
}));

vi.mock('../services/callBoardLayoutsService', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    get:  vi.fn().mockResolvedValue(null),
    getDefault: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    saveTiles: vi.fn(),
  },
}));

// react-grid-layout pulls CSS that vitest/jsdom doesn't need; stub the editor
// so we don't actually load the grid library inside unit tests.
vi.mock('./callboard/CallBoardEditor', () => ({
  default: () => null,
}));
vi.mock('./callboard/LayoutSettingsDialog', () => ({
  default: () => null,
}));

import CallBoard from './CallBoard';

const baseEntry = {
  call_id: null,
  called_at: null,
  operator_name: null,
  technician_name: null,
  technician_arrived_at: null,
  suspended_at: null,
  suspension_notes: null,
  priority: null,
  shift_name: null,
  pm_id: null,
  pm_started_at: null,
  location: null,
  queue_position: null,
} as const;

beforeEach(() => {
  getBoardStatus.mockReset();
});

describe('CallBoard', () => {
  it('renders the header with the board title', async () => {
    getBoardStatus.mockResolvedValueOnce([]);
    render(<CallBoard />);
    expect(await screen.findByText(/maintenance call board/i)).toBeInTheDocument();
  });

  it('shows the "no machines to display" message when board is empty', async () => {
    getBoardStatus.mockResolvedValueOnce([]);
    render(<CallBoard />);
    expect(await screen.findByText(/no machines to display/i)).toBeInTheDocument();
  });

  it('renders a tile for every machine with its name and status label', async () => {
    getBoardStatus.mockResolvedValueOnce([
      { ...baseEntry, machine_id: 1, name: 'Press 701', status: 'running' },
      { ...baseEntry, machine_id: 2, name: 'Press 702', status: 'wait', call_id: 7, called_at: new Date().toISOString(), operator_name: 'Joe' },
      { ...baseEntry, machine_id: 3, name: 'Press 703', status: 'pm', pm_id: 5, pm_started_at: new Date().toISOString() },
    ]);
    render(<CallBoard />);
    expect(await screen.findByText('Press 701')).toBeInTheDocument();
    expect(screen.getByText('Press 702')).toBeInTheDocument();
    expect(screen.getByText('Press 703')).toBeInTheDocument();
    // Status label appears in both the legend chip and tile header for each used status.
    expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('WAIT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PM').length).toBeGreaterThan(0);
  });

  it('updates the legend counts based on entries', async () => {
    getBoardStatus.mockResolvedValueOnce([
      { ...baseEntry, machine_id: 1, name: 'A', status: 'wait',    call_id: 1, called_at: new Date().toISOString() },
      { ...baseEntry, machine_id: 2, name: 'B', status: 'wait',    call_id: 2, called_at: new Date().toISOString() },
      { ...baseEntry, machine_id: 3, name: 'C', status: 'running' },
    ]);
    render(<CallBoard />);
    await screen.findByText('A');
    // The legend Box for WAIT should sit next to a "2".
    const waitLabel = screen.getAllByText('WAIT')[0];
    const waitBox = waitLabel.closest('div')!;
    expect(waitBox.textContent).toContain('2');
  });

  it('renders the queue position badge on WAIT tiles', async () => {
    getBoardStatus.mockResolvedValueOnce([
      { ...baseEntry, machine_id: 1, name: 'Press A', status: 'wait', call_id: 10, called_at: new Date().toISOString(), queue_position: 1 },
      { ...baseEntry, machine_id: 2, name: 'Press B', status: 'wait', call_id: 11, called_at: new Date().toISOString(), queue_position: 2 },
      { ...baseEntry, machine_id: 3, name: 'Press C', status: 'running' },
    ]);
    render(<CallBoard />);
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('keeps showing the prior board when fetch fails (no crash)', async () => {
    getBoardStatus.mockRejectedValueOnce(new Error('network'));
    render(<CallBoard />);
    expect(await screen.findByText(/maintenance call board/i)).toBeInTheDocument();
  });
});
