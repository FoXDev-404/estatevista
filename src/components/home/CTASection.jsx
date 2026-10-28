import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SmartImage from '../common/SmartImage';
import site from '../../data/site';
import homeContent from '../../data/home';

export default function CTASection() {
  return (
    <section className="cta-section" aria-labelledby="home-cta-title">
      <div className="cta-section__media" aria-hidden="true">
        <SmartImage
          src="/images/about-1.jpg"
          alt=""
          className="cta-section__image"
          loading="lazy"
          width="1800"
          height="1000"
        />
      </div>
      <span className="cta-section__overlay" aria-hidden="true" />
      <Container className="cta-section__inner">
        <p className="eyebrow eyebrow--light">{homeContent.cta.eyebrow}</p>
        <h2 id="home-cta-title" className="cta-section__title">{homeContent.cta.title}</h2>
        <p className="cta-section__description">{homeContent.cta.description}</p>
        <div className="cta-section__actions">
          <Link className="button button--gold button--lg" to={site.contactCta.href}>
            {site.contactCta.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link className="button button--outline-light button--lg" to="/properties">
            {homeContent.cta.browseLabel}
          </Link>
        </div>
      </Container>
    </section>
  );
}
