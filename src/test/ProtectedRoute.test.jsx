import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AuthContext from '../context/AuthContext';

function renderGuard({ status, permissions = [], user = null, permission, initialEntry = '/admin' }) {
  const value = {
    status,
    user,
    company: null,
    permissions,
    roles: [],
    hasPermission: (key) => permissions.includes('*') || permissions.includes(key),
    login: async () => {},
    logout: async () => {},
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<p>Login screen</p>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute permission={permission}>
                <p>Workspace content</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects anonymous visitors to login with the next path', () => {
    renderGuard({ status: 'anonymous' });

    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('shows a session check while bootstrapping', () => {
    renderGuard({ status: 'loading' });

    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
  });

  it('renders the workspace when the permission is granted', () => {
    renderGuard({
      status: 'authenticated',
      permissions: ['properties.view'],
      user: { id: 'user-1' },
      permission: 'properties.view',
    });

    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('shows a restriction message when the permission is missing', () => {
    renderGuard({
      status: 'authenticated',
      permissions: ['leads.view'],
      user: { id: 'user-1' },
      permission: 'properties.view',
    });

    expect(screen.getByText('This area is not part of your role.')).toBeInTheDocument();
    expect(screen.queryByText('Workspace content')).not.toBeInTheDocument();
  });
});
