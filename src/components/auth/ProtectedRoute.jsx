import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ permission, children }) {
  const { status, hasPermission } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="auth-guard" role="status" aria-live="polite">
        <span className="auth-guard__spinner" aria-hidden="true" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="container">
        <section className="admin-page auth-denied">
          <div className="auth-denied__card">
            <ShieldAlert size={26} aria-hidden="true" />
            <p className="admin-page__eyebrow">Access restricted</p>
            <h1 className="auth-denied__title">This area is not part of your role.</h1>
            <p className="admin-page__description">
              Ask a workspace administrator to review your role permissions, or return to the
              public website.
            </p>
            <a className="button button--secondary button--md" href="/">
              Return to the website
            </a>
          </div>
        </section>
      </div>
    );
  }

  return children ?? <Outlet />;
}
