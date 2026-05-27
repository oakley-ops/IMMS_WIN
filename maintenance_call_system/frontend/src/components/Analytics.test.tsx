import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { getMetrics, getPartsMetrics, getMachines } = vi.hoisted(() => ({
  getMetrics: vi.fn(),
  getPartsMetrics: vi.fn(),
  getMachines: vi.fn(),
}));

vi.mock('../services/maintenanceCallService', () => ({
  default: { getMetrics, getPartsMetrics, getMachines },
}));

import Analytics from './Analytics';

const emptyMetrics = {
  overall: {
    total_calls: '0', open_calls: 0, avg_response_minutes: null,
    avg_repair_minutes: null, avg_downtime_minutes: null,
    total_downtime_hours: null, total_downtime_cost: null,
    sla_pct: null, critical_calls: '0',
  },
  by_machine: [], by_reason: [], by_shift: [], by_tech: [],
  trend_weekly: [], repeat_failures: [],
};

const emptyParts = { top_parts: [], by_machine: [], by_tech: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getMetrics.mockResolvedValue(emptyMetrics);
  getPartsMetrics.mockResolvedValue(emptyParts);
  getMachines.mockResolvedValue([]);
});

describe('Analytics', () => {
  it('renders all four section headers', async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText(/PRODUCTION HEALTH/i)).toBeInTheDocument();
      expect(screen.getByText(/PARTS CONSUMPTION/i)).toBeInTheDocument();
      expect(screen.getByText(/EQUIPMENT/i)).toBeInTheDocument();
      expect(screen.getByText(/TEAM PERFORMANCE/i)).toBeInTheDocument();
    });
  });

  it('renders a Critical Calls KPI card', async () => {
    getMetrics.mockResolvedValueOnce({
      ...emptyMetrics,
      overall: { ...emptyMetrics.overall, critical_calls: '5' },
    });
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText(/Critical Calls/i)).toBeInTheDocument();
    });
  });

  it('calls getPartsMetrics on mount alongside getMetrics', async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(getPartsMetrics).toHaveBeenCalledTimes(1);
      expect(getMetrics).toHaveBeenCalledTimes(1);
    });
  });

  it('renders a Machine filter dropdown', async () => {
    getMachines.mockResolvedValueOnce([
      { machine_id: 125, name: 'Die Press 701', location: 'Floor 1' },
    ]);
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Machine/i)).toBeInTheDocument();
    });
  });

  it('shows Suspensions column in technician workload table when techs are present', async () => {
    getMetrics.mockResolvedValueOnce({
      ...emptyMetrics,
      by_tech: [{ technician_id: 1, technician_name: 'John D.', call_count: '8', avg_response_minutes: '5', avg_repair_minutes: '30', sla_pct: '90', suspensions: '2' }],
    });
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText('Suspensions')).toBeInTheDocument();
      expect(screen.getByText('John D.')).toBeInTheDocument();
    });
  });
});
