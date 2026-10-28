import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SmartImage from '../common/SmartImage';
import site from '../../data/site';

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
        <p className="eyebrow eyebrow--light">Begin a conversation</p>
        <h2 id="home-cta-title" className="cta-section__title">
          Your next chapter deserves a considered beginning.
        </h2>
        <p className="cta-section__description">
          Tell us what you are looking for, or simply what home means to you. We will help you
          take the next step with clarity.
        </p>
        <div className="cta-section__actions">
          <Link className="button button--gold button--lg" to={site.contactCta.href}>
            {site.contactCta.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link className="button button--outline-light button--lg" to="/properties">
            Browse properties
          </Link>
        </div>
      </Container>
    </section>
  );
}
