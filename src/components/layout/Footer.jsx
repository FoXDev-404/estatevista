import { Link } from 'react-router-dom';
import { ArrowUpRight, BriefcaseBusiness, Camera, Globe, Mail, MapPin, Phone, Pin } from 'lucide-react';
import Logo from '../common/Logo';
import Container from '../common/Container';
import { footerNavigation } from '../../data/navigation';
import site from '../../data/site';
import contactDetails from '../../data/contact';

const socialIcons = {
  Camera,
  BriefcaseBusiness,
  Pin,
  Globe,
};

export default function Footer() {
  const year = new Date().getFullYear();
  const visibleSocials = contactDetails.socials.filter((social) => social.url);

  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Logo variant="light" />
            <p className="site-footer__tagline">{site.tagline}</p>
            <p className="site-footer__description">{site.description}</p>
            <Link className="text-link text-link--light" to={site.contactCta.href}>
              {site.contactCta.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="site-footer__nav">
            {footerNavigation.map((group) => (
              <nav key={group.title} aria-label={`Footer: ${group.title}`}>
                <h2 className="site-footer__heading">{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="site-footer__contact-row">
          <div className="site-footer__contact">
            <a href={contactDetails.phone.href}>
              <Phone size={16} aria-hidden="true" />
              {contactDetails.phone.label}
            </a>
            <a href={contactDetails.email.href}>
              <Mail size={16} aria-hidden="true" />
              {contactDetails.email.label}
            </a>
            <span>
              <MapPin size={16} aria-hidden="true" />
              {contactDetails.address.lines.join(', ')}
            </span>
          </div>
          {visibleSocials.length > 0 ? (
            <div className="site-footer__socials" aria-label="Social media demo links">
              {visibleSocials.map((social) => {
                const Icon = socialIcons[social.icon] || Globe;
                return (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            © {year} {site.name}. Premium real estate marketplace.
          </p>
          <p className="site-footer__notice">{site.notice}</p>
        </div>
      </Container>
    </footer>
  );
}
