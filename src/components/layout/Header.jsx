import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Logo from '../common/Logo';
import MobileNavigation from './MobileNavigation';
import { mainNavigation } from '../../data/navigation';
import site from '../../data/site';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`site-header${isScrolled ? ' is-scrolled' : ''}`}>
        <div className="container site-header__inner">
          <Logo onClick={() => setIsMenuOpen(false)} />

          <nav className="primary-nav" aria-label="Primary navigation">
            <ul>
              {mainNavigation.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            <Link className="button button--primary button--sm site-header__cta" to={site.contactCta.href}>
              {site.contactCta.label}
            </Link>
            <button
              type="button"
              className="menu-button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu size={23} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <MobileNavigation open={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
