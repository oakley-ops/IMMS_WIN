import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { replace, login } = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login }),
}));

import LoginForm from './LoginForm';

beforeEach(() => {
  replace.mockReset();
  login.mockReset();
});

describe('LoginForm', () => {
  it('disables the submit button when either field is empty', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('enables the submit button when both fields are filled', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } });
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });

  it('calls login() and navigates to /calls on successful submit', async () => {
    login.mockResolvedValueOnce(undefined);
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'pass'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/calls'));
  });

  it('shows an error message when login() throws', async () => {
    login.mockRejectedValueOnce(new Error('bad creds'));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
