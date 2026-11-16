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
