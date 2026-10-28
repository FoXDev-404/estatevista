import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ExternalLink, LayoutDashboard, LockKeyhole } from 'lucide-react';
import Logo from '../common/Logo';

export default function AdminLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    if (main) {
      const timer = window.setTimeout(() => main.focus({ preventScroll: true }), 50);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

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
          </nav>
        </div>
      </header>

      <div className="admin-local-banner">
        <div className="container admin-local-banner__inner">
          <LockKeyhole size={16} aria-hidden="true" />
          <p>
            This dashboard stores records in the browser with localStorage for quick testing and editing.
          </p>
        </div>
      </div>

      <main id="main-content" className="admin-main" tabIndex="-1">
        <Outlet />
      </main>
    </div>
  );
}
