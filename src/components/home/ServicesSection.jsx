import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import ServiceCard from '../common/ServiceCard';
import services from '../../data/services';

export default function ServicesSection({ limit = 3 }) {
  const visibleServices = Number.isInteger(limit) ? services.slice(0, limit) : services;

  return (
    <section className="services-overview section section--ivory">
      <Container>
        <SectionHeading
          eyebrow="Our services"
          title="A considered level of service."
          description="Whether you are buying, selling, renting or simply seeking a second perspective, our role is to make the process clearer."
          action={
            <Link className="text-link" to="/services">
              Explore all services
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
