import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { ArrowUpRight, Mail, Phone, X } from 'lucide-react';
import Logo from '../common/Logo';
import { mainNavigation } from '../../data/navigation';
import site from '../../data/site';
import contactDetails from '../../data/contact';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileNavigation({ open, onClose }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    triggerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstLink = dialogRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (dialogRef.current?.querySelector('[data-mobile-close]') || firstLink)?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="mobile-nav"
      id="mobile-navigation"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      ref={dialogRef}
    >
      <div className="container mobile-nav__top">
        <Logo variant="light" onClick={onClose} />
        <button
          type="button"
          className="mobile-nav__close"
          onClick={onClose}
          aria-label="Close navigation menu"
          data-mobile-close
        >
          <X size={24} aria-hidden="true" />
        </button>
      </div>

      <div className="container mobile-nav__body">
        <nav aria-label="Mobile primary navigation">
          <ul className="mobile-nav__links">
            {mainNavigation.map((item, index) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                  onClick={onClose}
                >
                  <span className="mobile-nav__index">{String(index + 1).padStart(2, '0')}</span>
                  <span>{item.label}</span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mobile-nav__footer">
          <a className="mobile-nav__contact" href={contactDetails.phone.href}>
            <Phone size={17} aria-hidden="true" />
            {contactDetails.phone.label}
          </a>
          <a className="mobile-nav__contact" href={contactDetails.email.href}>
            <Mail size={17} aria-hidden="true" />
            {contactDetails.email.label}
          </a>
          <p className="mobile-nav__note">{site.notice}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
