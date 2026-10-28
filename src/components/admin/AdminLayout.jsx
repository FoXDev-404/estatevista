import { useEffect } from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ExternalLink, LayoutDashboard, LockKeyhole } from 'lucide-react';
import Logo from '../common/Logo';
import useAuth from '../../hooks/useAuth';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const location = useLocation();
  const { isAdmin, isLoading, isSupabaseConfigured, signOut } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    if (main) {
      const timer = window.setTimeout(() => main.focus({ preventScroll: true }), 50);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

  if (isSupabaseConfigured && pathname === '/admin/login') {
    return <Outlet />;
  }
  if (isSupabaseConfigured && isLoading) {
    return <main className="admin-main admin-loading" aria-live="polite">Checking administrator session…</main>;
  }
  if (isSupabaseConfigured && !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="container admin-topbar__inner">
          <div className="admin-topbar__brand">
            <Logo />
            <span className="admin-topbar__divider" aria-hidden="true" />
            <span className="admin-topbar__label">Property studio</span>
          </div>

          <nav className="admin-topbar__nav" aria-label="Administration">
            <NavLink
              to="/admin/properties"
              end
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              <LayoutDashboard size={17} aria-hidden="true" />
              Dashboard
            </NavLink>
            <Link to="/">
              <ExternalLink size={17} aria-hidden="true" />
              View website
            </Link>
            {isSupabaseConfigured ? (
              <button type="button" className="admin-topbar__signout" onClick={signOut}>
                Sign out
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <div className="admin-local-banner">
        <div className="container admin-local-banner__inner">
          <LockKeyhole size={16} aria-hidden="true" />
          <p>
            {isSupabaseConfigured
              ? 'Shared property data is managed through Supabase. Only authorized administrators can edit records.'
              : 'Supabase is not configured. Local browser storage is active for development only.'}
          </p>
        </div>
      </div>

      <main id="main-content" className="admin-main" tabIndex="-1">
        <Outlet />
      </main>
    </div>
  );
}
