import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PartsConsumptionSection from './PartsConsumptionSection';
import type { PartsMetrics } from '../../services/maintenanceCallService';

const emptyParts: PartsMetrics = { top_parts: [], by_machine: [], by_tech: [] };

const filledParts: PartsMetrics = {
  top_parts: [
    { part_id: 1, part_name: 'Bearing 6205', part_number: 'B-6205', total_qty: 24, call_count: 8 },
  ],
  by_machine: [
    { machine_id: 125, machine_name: 'Die Press 701', unique_parts: 6, total_qty: 38 },
  ],
  by_tech: [
    { technician_id: 1, technician_name: 'John D.', calls_with_parts: 12, unique_parts: 5, total_qty: 30 },
  ],
};

describe('PartsConsumptionSection', () => {
  it('shows "No data" for panels when arrays are empty', () => {
    render(<PartsConsumptionSection partsMetrics={emptyParts} loading={false} error={null} />);
    expect(screen.getAllByText(/No data/i).length).toBeGreaterThanOrEqual(2);
  });

  it('renders part name in the top parts bar chart', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('Bearing 6205')).toBeInTheDocument();
  });

  it('renders machine name in the by-machine bar chart', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('Die Press 701')).toBeInTheDocument();
  });

  it('renders technician name in the by-tech table', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('John D.')).toBeInTheDocument();
  });

  it('shows a loading spinner when loading=true', () => {
    render(<PartsConsumptionSection partsMetrics={null} loading={true} error={null} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an inline error alert without hiding the whole section', () => {
    render(<PartsConsumptionSection partsMetrics={null} loading={false} error="Failed to load parts" />);
    expect(screen.getByText(/Failed to load parts/i)).toBeInTheDocument();
    // Section header still visible even when error is shown
    expect(screen.getByText(/Top Parts/i)).toBeInTheDocument();
  });
});
