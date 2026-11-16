import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ExternalLink,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  {
    to: '/admin/properties',
    label: 'Property studio',
    icon: Building2,
    permission: 'properties.view',
  },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, company, roles, hasPermission, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    if (main) {
      const timer = window.setTimeout(() => main.focus({ preventScroll: true }), 50);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission));
  const initials = (user?.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const roleLabel = roles?.length ? roles.join(' · ') : 'Team member';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="container admin-topbar__inner">
          <div className="admin-topbar__brand">
            <Logo />
            <span className="admin-topbar__divider" aria-hidden="true" />
            <span className="admin-topbar__label">
              {company?.name ? `${company.name} workspace` : 'Company workspace'}
            </span>
          </div>

          <div className="admin-topbar__actions">
            <nav className="admin-topbar__nav" aria-label="Administration">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
              <Link to="/">
                <ExternalLink size={17} aria-hidden="true" />
                View website
              </Link>
            </nav>

            <div className="admin-user" ref={menuRef}>
              <button
                type="button"
                className="admin-user__trigger"
                onClick={() => setMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="admin-user__avatar" aria-hidden="true">
                  {initials}
                </span>
                <span className="admin-user__meta">
                  <span className="admin-user__name">{user?.name || 'Account'}</span>
                  <span className="admin-user__role">{roleLabel}</span>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>

              {menuOpen ? (
                <div className="admin-user__menu" role="menu">
                  <div className="admin-user__summary">
                    <p className="admin-user__summary-name">{user?.name}</p>
                    <p className="admin-user__summary-email">{user?.email}</p>
                    <p className="admin-user__summary-company">
                      <ShieldCheck size={13} aria-hidden="true" />
                      {roleLabel}
                    </p>
                  </div>
                  <div className="admin-user__divider" aria-hidden="true" />
                  <Link className="admin-user__item" to="/" role="menuitem">
                    <ExternalLink size={15} aria-hidden="true" />
                    View website
                  </Link>
                  <button
                    type="button"
                    className="admin-user__item admin-user__item--danger"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    role="menuitem"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="admin-main" tabIndex="-1">
        <Outlet />
      </main>
    </div>
  );
}
