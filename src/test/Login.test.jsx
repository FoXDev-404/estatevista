import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from '../pages/Login';
import AuthContext from '../context/AuthContext';

function renderLogin({ login, initialEntry = '/login?next=/admin/properties' }) {
  return render(
    <AuthContext.Provider
      value={{
        status: 'anonymous',
        user: null,
        company: null,
        permissions: [],
        roles: [],
        hasPermission: () => false,
        login,
        logout: async () => {},
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/properties" element={<p>Property workspace</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Login page', () => {
  it('shows the server error and field feedback when sign-in fails', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(
      Object.assign(new Error('Invalid email or password.'), {
        fields: { password: 'Enter your password.' },
      }),
    );

    renderLogin({ login });

    await user.type(screen.getByLabelText('Work email'), 'avery@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ email: 'avery@example.com', password: 'wrong-password' });
  });

  it('offers demo credentials that fill the sign-in form without submitting', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

    renderLogin({ login });

    const demo = screen.getByRole('group', { name: 'Demo accounts' });
    expect(demo).toHaveTextContent('jordan@meridian-estates.test');
    expect(demo).toHaveTextContent('MeridianDesk2026');
    expect(demo).toHaveTextContent('casey@meridian-estates.test');
    expect(demo).toHaveTextContent('SalesAgent2026');

    await user.click(screen.getByRole('button', { name: 'Use company admin demo account' }));

    expect(screen.getByLabelText('Work email')).toHaveValue('jordan@meridian-estates.test');
    expect(screen.getByLabelText('Password')).toHaveValue('MeridianDesk2026');
    expect(screen.getByLabelText('Work email')).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it('clears a failed sign-in message when a demo account is chosen', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password.'));

    renderLogin({ login });

    await user.type(screen.getByLabelText('Work email'), 'avery@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');

    await user.click(screen.getByRole('button', { name: 'Use sales agent demo account' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveValue('casey@meridian-estates.test');
    expect(screen.getByLabelText('Password')).toHaveValue('SalesAgent2026');
  });

  it('signs in and continues to the requested page', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

    renderLogin({ login });

    await user.type(screen.getByLabelText('Work email'), 'avery@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Property workspace')).toBeInTheDocument();
  });
});
