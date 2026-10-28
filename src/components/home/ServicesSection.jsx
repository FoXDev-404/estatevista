import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import ServiceCard from '../common/ServiceCard';
import services from '../../data/services';
import homeContent from '../../data/home';

export default function ServicesSection({ limit = 3 }) {
  const visibleServices = Number.isInteger(limit) ? services.slice(0, limit) : services;

  return (
    <section className="services-overview section section--ivory">
      <Container>
        <SectionHeading
          {...homeContent.services}
          action={
            <Link className="text-link" to="/services">
              {homeContent.services.ctaLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className={`service-grid service-grid--${Math.min(visibleServices.length, 3)}`}>
          {visibleServices.map((service, index) => (
            <ServiceCard key={service.id} service={service} index={index} compact />
          ))}
        </div>
      </Container>
    </section>
  );
}
