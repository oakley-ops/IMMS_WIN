import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { getUsers, savePermissions } = vi.hoisted(() => ({
  getUsers: vi.fn(),
  savePermissions: vi.fn(),
}));

vi.mock('../../services/permissionsService', () => ({
  default: { getUsers, savePermissions },
}));

import PermissionsPanel from './PermissionsPanel';

const sampleUsers = [
  {
    user_id: 2,
    username: 'maria.santos',
    role: 'tech',
    permissions: { badges_add: false, readers_manage: false, calls_manage: true, analytics_view: true, skilled_operator: false },
    updated_at: null,
    updated_by_username: null,
  },
  {
    user_id: 3,
    username: 'john.doe',
    role: 'purchasing',
    permissions: { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false },
    updated_at: null,
    updated_by_username: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getUsers.mockResolvedValue(sampleUsers);
});

describe('PermissionsPanel', () => {
  it('renders the user list after loading', async () => {
    render(<PermissionsPanel />);
    expect(await screen.findByText('maria.santos')).toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
  });

  it('renders search box that filters the user list', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    const search = screen.getByPlaceholderText(/search/i);
    await userEvent.type(search, 'john');
    expect(screen.queryByText('maria.santos')).not.toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
  });

  it('shows permission checkboxes when a user is selected', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    expect(await screen.findByLabelText(/Add new badges/i)).toBeInTheDocument();
  });

  it('locked items render with a lock icon (Edit / deactivate badges)', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    await screen.findByLabelText(/Add new badges/i);
    expect(screen.getByText(/Edit \/ deactivate badges/i)).toBeInTheDocument();
    const lockIcons = screen.getAllByTestId('lock-icon');
    expect(lockIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('applies Supervisor preset when clicked', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    await screen.findByRole('button', { name: /Supervisor/i });
    await userEvent.click(screen.getByRole('button', { name: /Supervisor/i }));
    const badgesAddCheckbox = screen.getByLabelText(/Add new badges/i) as HTMLInputElement;
    expect(badgesAddCheckbox.checked).toBe(true);
  });

  it('calls savePermissions with correct payload when Save is clicked', async () => {
    savePermissions.mockResolvedValue({ ...sampleUsers[1], permissions: { ...sampleUsers[1].permissions, badges_add: true } });
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByLabelText(/Add new badges/i);
    await userEvent.click(screen.getByLabelText(/Add new badges/i));
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(savePermissions).toHaveBeenCalledWith(3, expect.objectContaining({ badges_add: true }));
    });
  });

  it('shows success message after save', async () => {
    savePermissions.mockResolvedValue(sampleUsers[1]);
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByRole('button', { name: /Save Changes/i });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(await screen.findByText(/Permissions saved/i)).toBeInTheDocument();
  });

  it('shows error message when save fails', async () => {
    savePermissions.mockRejectedValue(new Error('Network error'));
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByRole('button', { name: /Save Changes/i });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(await screen.findByText(/Failed to save/i)).toBeInTheDocument();
  });

  it('role-default checkboxes are disabled for tech users (calls_manage)', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    // maria.santos is role=tech; calls_manage is a tech role default — must be disabled
    const callsCheckbox = await screen.findByLabelText(/Create \/ resolve \/ suspend calls/i) as HTMLInputElement;
    expect(callsCheckbox.disabled).toBe(true);
    expect(callsCheckbox.checked).toBe(true);
  });
});
