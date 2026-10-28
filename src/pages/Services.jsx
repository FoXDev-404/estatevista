import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../components/common/Container';
import PageHeader from '../components/common/PageHeader';
import PageMeta from '../components/common/PageMeta';
import SectionHeading from '../components/common/SectionHeading';
import ServiceCard from '../components/common/ServiceCard';
import services, { serviceProcess } from '../data/services';
import contactDetails from '../data/contact';

export default function Services() {
  return (
    <>
      <PageMeta
        title="Services"
        description="Buying, selling, renting, consultation and property management services from EstateVista — a demonstration real estate marketplace."
        image="/images/service-4.jpg"
      />

      <PageHeader
        eyebrow="Our services"
        title="A thoughtful partner at every stage."
        description="From the first search to the ongoing care of a property, EstateVista is built around clear advice, considered presentation and a human process."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Services' }]}
        image="/images/service-4.jpg"
        imageAlt="An advisor in conversation with clients in a bright studio"
        tone="dark"
        aside={
          <div className="page-header__aside-stat">
            <span>05</span>
            <p>considered services, one clear process</p>
          </div>
        }
      />

      <section className="services-page section">
        <Container>
          <SectionHeading
            eyebrow="How we can help"
            title="Support for every property decision."
            description="Each service is designed to bring clarity and reduce friction, whether you are moving, investing or considering a change."
          />
          <div className="service-grid service-grid--all">
            {services.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        </Container>
      </section>

      <section className="process-section section section--ivory" aria-labelledby="process-title">
        <Container>
          <SectionHeading
            eyebrow="The process"
            title="Four steps, thoughtfully paced."
            description="A simple framework that keeps the important details in view."
            id="process-title"
          />
          <ol className="process-grid">
            {serviceProcess.map((step) => (
              <li className="process-step" key={step.number}>
                <span className="process-step__number">{step.number}</span>
                <h3 className="process-step__title">{step.title}</h3>
                <p className="process-step__description">{step.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="services-cta section section--dark">
        <Container>
          <div className="services-cta__inner">
            <div>
              <p className="eyebrow eyebrow--light">Not sure where to begin?</p>
              <h2 className="services-cta__title">Start with a conversation.</h2>
              <p className="services-cta__copy">
                Tell us what you are considering. We will help you find the right next step, with
                no obligation and no pressure.
              </p>
            </div>
            <div className="services-cta__actions">
              <Link className="button button--gold button--lg" to="/contact">
                Contact EstateVista
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a className="text-link text-link--light" href={contactDetails.phone.href}>
                {contactDetails.phone.label}
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
