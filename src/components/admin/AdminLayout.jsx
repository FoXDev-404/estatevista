import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BookmarkCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Contact,
  ExternalLink,
  FileText,
  FileSignature,
  Handshake,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Logo from '../common/Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import { initialsOf } from '../../services/adminFormatters';

const NAV_GROUPS = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        to: '/admin/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
      },
      {
        to: '/admin/properties',
        label: 'Property studio',
        icon: Building2,
        permission: 'properties.view',
      },
      {
        to: '/admin/projects',
        label: 'Projects',
        icon: Building2,
        permission: 'projects.view',
      },
      {
        to: '/admin/units',
        label: 'Units',
        icon: LayoutGrid,
        permission: 'units.view',
      },
      {
        to: '/admin/leads',
        label: 'Leads',
        icon: UserPlus,
        permission: 'leads.view',
      },
      {
        to: '/admin/inquiries',
        label: 'Website inquiries',
        icon: Inbox,
        permission: 'inquiries.view',
      },
      {
        to: '/admin/visits',
        label: 'Visits',
        icon: CalendarDays,
        permission: 'visits.view',
      },
      {
        to: '/admin/customers',
        label: 'Customers',
        icon: Contact,
        permission: 'customers.view',
      },
      {
        to: '/admin/quotations',
        label: 'Quotations',
        icon: FileText,
        permission: 'quotations.view',
      },
      {
        to: '/admin/reservations',
        label: 'Reservations',
        icon: BookmarkCheck,
        permission: 'reservations.view',
      },
      {
        to: '/admin/sales',
        label: 'Sales',
        icon: Handshake,
        permission: 'sales.view',
      },
      {
        to: '/admin/installments',
        label: 'Installments',
        icon: CalendarClock,
        permission: 'sales.view',
      },
      {
        to: '/admin/collections',
        label: 'Collections',
        icon: Banknote,
        permission: 'collections.view',
      },
      {
        to: '/admin/commissions',
        label: 'Commissions',
        icon: Percent,
        permission: 'commissions.view',
      },
    ],
  },
  {
    id: 'rental',
    label: 'Rental',
    items: [
      {
        to: '/admin/tenants',
        label: 'Tenants',
        icon: Users,
        permission: 'tenants.view',
      },
      {
        to: '/admin/leases',
        label: 'Leases',
        icon: FileSignature,
        permission: 'leases.view',
      },
      {
        to: '/admin/rent-roll',
        label: 'Rent roll',
        icon: CalendarClock,
        permission: 'rent.view',
      },
      {
        to: '/admin/rent-collections',
        label: 'Rent collections',
        icon: Banknote,
        permission: 'rent.view',
      },
      {
        to: '/admin/deposits',
        label: 'Security deposits',
        icon: ShieldCheck,
        permission: 'deposits.view',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        to: '/admin/branches',
        label: 'Branches',
        icon: MapPin,
        permission: 'branches.view',
      },
      {
        to: '/admin/team',
        label: 'Team',
        icon: Users,
        permission: 'team.view',
      },
      {
        to: '/admin/roles',
        label: 'Roles & permissions',
        icon: ShieldCheck,
        permission: 'roles.view',
      },
      {
        to: '/admin/audit-logs',
        label: 'Audit log',
        icon: ScrollText,
        permission: 'audit.view',
      },
      {
        to: '/admin/settings',
        label: 'Settings',
        icon: Settings,
        permission: 'settings.view',
      },
    ],
  },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, company, roles, hasPermission, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(item.permission)),
  })).filter((group) => group.items.length);

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
            <button
              type="button"
              className="admin-menu-toggle"
              onClick={() => setSidebarOpen((current) => !current)}
              aria-label={sidebarOpen ? 'Close workspace menu' : 'Open workspace menu'}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
            >
              {sidebarOpen ? (
                <X size={19} aria-hidden="true" />
              ) : (
                <Menu size={19} aria-hidden="true" />
              )}
            </button>
            <Logo />
            <span className="admin-topbar__divider" aria-hidden="true" />
            <span className="admin-topbar__label">
              {company?.name ? `${company.name} workspace` : 'Company workspace'}
            </span>
          </div>

          <div className="admin-topbar__actions">
            <Link className="admin-topbar__site" to="/">
              <ExternalLink size={16} aria-hidden="true" />
              <span>View website</span>
            </Link>

            <NotificationBell />

            <div className="admin-user" ref={menuRef}>
              <button
                type="button"
                className="admin-user__trigger"
                onClick={() => setMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="admin-user__avatar" aria-hidden="true">
                  {initialsOf(user?.name) || '?'}
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
                      {company?.name || 'Company workspace'}
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

      <div className="admin-body">
        <aside
          id="admin-sidebar"
          className={`admin-sidebar${sidebarOpen ? ' is-open' : ''}`}
        >
          <nav className="admin-sidebar__nav" aria-label="Workspace">
            {visibleGroups.map((group) => (
              <div className="admin-sidebar__group" key={group.id}>
                <p className="admin-sidebar__title">{group.label}</p>
                <ul>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            `admin-sidebar__link${isActive ? ' is-active' : ''}`
                          }
                          onClick={() => setSidebarOpen(false)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="admin-sidebar__footer">
            <p className="admin-sidebar__company">{company?.name || 'Company workspace'}</p>
            <p className="admin-sidebar__role">{roleLabel}</p>
            <Link className="admin-sidebar__site" to="/">
              <ExternalLink size={14} aria-hidden="true" />
              Open public website
            </Link>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            className="admin-sidebar__overlay"
            aria-label="Close workspace menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main id="main-content" className="admin-main" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
