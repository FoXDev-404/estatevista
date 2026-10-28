import {
  BriefcaseBusiness,
  Camera,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Pin,
} from 'lucide-react';
import Container from '../components/common/Container';
import PageHeader from '../components/common/PageHeader';
import PageMeta from '../components/common/PageMeta';
import ContactForm from '../components/contact/ContactForm';
import contactDetails from '../data/contact';

const socialIcons = {
  Camera,
  BriefcaseBusiness,
  Pin,
  Globe,
};

export default function Contact() {
  const hasMap = Boolean(
    contactDetails.map?.embedUrl &&
      /^https?:\/\//i.test(contactDetails.map.embedUrl),
  );
  const visibleSocials = contactDetails.socials.filter((social) => social.url);

  return (
    <>
      <PageMeta
        title="Contact"
        description="Contact EstateVista to discuss buying, selling, renting or managing a property. Demonstration contact details and a local-only enquiry form."
      />

      <PageHeader
        eyebrow="Contact EstateVista"
        title="Start a conversation."
        description="Tell us what you are looking for, or what you are considering. A thoughtful first conversation is often the most useful next step."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
        aside={
          <div className="contact-header-note">
            <p className="contact-header-note__label">Demonstration contact</p>
            <p>
              Every contact detail below is a placeholder for this assignment project. No real
              business is represented.
            </p>
          </div>
        }
      />

      <section className="contact-page section">
        <Container>
          <div className="contact-layout">
            <div className="contact-layout__form">
              <div className="contact-form-card">
                <p className="eyebrow">Send an enquiry</p>
                <h2 className="contact-form-card__title">How can we help?</h2>
                <p className="contact-form-card__intro">
                  Share a few details below. This local demonstration validates your message but
                  does not transmit it.
                </p>
                <ContactForm />
              </div>
            </div>

            <aside className="contact-layout__details" aria-label="Contact details">
              <div className="contact-details-card">
                <h2 className="contact-details-card__title">The details</h2>

                <ul className="contact-methods">
                  <li>
                    <span className="contact-methods__icon" aria-hidden="true">
                      <Phone size={18} />
                    </span>
                    <div>
                      <span>Telephone</span>
                      <a href={contactDetails.phone.href}>{contactDetails.phone.label}</a>
                    </div>
                  </li>
                  <li>
                    <span className="contact-methods__icon" aria-hidden="true">
                      <Mail size={18} />
                    </span>
                    <div>
                      <span>Email</span>
                      <a href={contactDetails.email.href}>{contactDetails.email.label}</a>
                    </div>
                  </li>
                  <li>
                    <span className="contact-methods__icon" aria-hidden="true">
                      <MapPin size={18} />
                    </span>
                    <div>
                      <span>{contactDetails.address.label}</span>
                      <address>
                        {contactDetails.address.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </address>
                    </div>
                  </li>
                  <li>
                    <span className="contact-methods__icon" aria-hidden="true">
                      <Clock size={18} />
                    </span>
                    <div>
                      <span>Business hours</span>
                      <dl className="contact-hours">
                        {contactDetails.hours.map((entry) => (
                          <div key={entry.label}>
                            <dt>{entry.label}</dt>
                            <dd>{entry.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </li>
                </ul>

                {visibleSocials.length > 0 ? (
                  <div className="contact-socials">
                    <span>Follow EstateVista</span>
                    <div>
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
                  </div>
                ) : null}

                <p className="contact-details-card__note">{contactDetails.note}</p>
              </div>
            </aside>
          </div>

          <div className="contact-map" aria-labelledby="contact-map-title">
            <div className="contact-map__header">
              <div>
                <p className="eyebrow">Location</p>
                <h2 id="contact-map-title" className="contact-map__title">
                  Visit the studio.
                </h2>
              </div>
              <p className="contact-map__note">{contactDetails.map.note}</p>
            </div>

            {hasMap ? (
              <iframe
                className="contact-map__frame"
                src={contactDetails.map.embedUrl}
                title={contactDetails.map.title}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="contact-map-placeholder">
                <span className="contact-map-placeholder__mark" aria-hidden="true">
                  <MapPin size={26} />
                </span>
                <div>
                  <p>Map preview not configured</p>
                  <span>
                    A verified office location and map embed URL can be supplied in
                    <code> src/data/contact.js</code>. Until then, no real address is implied.
                  </span>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
