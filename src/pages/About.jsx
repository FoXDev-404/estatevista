import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  Handshake,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import Container from '../components/common/Container';
import PageHeader from '../components/common/PageHeader';
import PageMeta from '../components/common/PageMeta';
import SectionHeading from '../components/common/SectionHeading';
import SmartImage from '../components/common/SmartImage';
import TeamCard from '../components/common/TeamCard';
import useProperties from '../hooks/useProperties';
import { getAvailableProperties } from '../services/propertySelectors';
import aboutContent from '../data/about';
import team from '../data/team';
import contactDetails from '../data/contact';

const valueIcons = {
  ScanSearch,
  Compass,
  Handshake,
  Sparkles,
};

export default function About() {
  const { properties } = useProperties();
  const available = getAvailableProperties(properties);
  const cities = new Set(available.map((property) => property.location?.city).filter(Boolean));
  const types = new Set(available.map((property) => property.type).filter(Boolean));

  const stats = [
    { value: available.length, label: 'Available properties' },
    { value: cities.size, label: 'Cities represented' },
    { value: types.size, label: 'Property categories' },
    { value: properties.length, label: 'Total records' },
  ];

  return (
    <>
      <PageMeta
        title="About"
        description="EstateVista is a considered real estate marketplace built around clarity, editorial presentation and a more human property search."
        image="/images/about-1.jpg"
      />

      <PageHeader
        eyebrow="The EstateVista story"
        title={aboutContent.title}
        description={aboutContent.intro}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
        image="/images/about-1.jpg"
        imageAlt="A refined living space with warm materials and garden views"
        tone="dark"
        aside={
          <p className="page-header__aside-note">
            Independent brand · Editorial property search · Curated homes
          </p>
        }
      />

      <section className="about-story section">
        <Container>
          <div className="about-story__layout">
            <div className="about-story__heading">
              <p className="eyebrow">Our perspective</p>
              <h2 className="about-story__title">Property, presented with care.</h2>
            </div>
            <div className="about-story__copy">
              {aboutContent.story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <Link className="text-link" to="/properties">
                Explore the collection
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="about-story__image-row">
            <div className="about-story__image about-story__image--wide">
              <SmartImage
                src="/images/about-3.jpg"
                alt="Interior with natural light, timber and considered furnishings"
                className="about-story__photo"
                loading="lazy"
                width="1400"
                height="900"
              />
            </div>
            <div className="about-story__image about-story__image--narrow">
              <SmartImage
                src="/images/about-2.jpg"
                alt="A quiet architectural detail with warm stone and plants"
                className="about-story__photo"
                loading="lazy"
                width="900"
                height="1100"
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="about-purpose section section--ivory">
        <Container>
          <div className="about-purpose__grid">
            <article className="about-purpose__card">
              <p className="eyebrow">Our mission</p>
              <h2 className="about-purpose__title">Clarity at every step.</h2>
              <p>{aboutContent.mission}</p>
            </article>
            <article className="about-purpose__card">
              <p className="eyebrow">Our vision</p>
              <h2 className="about-purpose__title">A higher standard of information.</h2>
              <p>{aboutContent.vision}</p>
            </article>
          </div>
        </Container>
      </section>

      <section className="about-values section">
        <Container>
          <SectionHeading
            eyebrow="What guides us"
            title="Values that shape the search."
            description="Four principles inform how we present properties and the experience of discovering them."
          />
          <div className="value-grid">
            {aboutContent.values.map((value) => {
              const Icon = valueIcons[value.icon] || Sparkles;
              return (
                <article className="value-card" key={value.title}>
                  <span className="value-card__icon" aria-hidden="true">
                    <Icon size={23} strokeWidth={1.35} />
                  </span>
                  <h3 className="value-card__title">{value.title}</h3>
                  <p className="value-card__description">{value.description}</p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="about-stats section section--dark" aria-labelledby="about-stats-title">
        <Container>
          <div className="about-stats__header">
            <div>
              <p className="eyebrow eyebrow--light">The EstateVista collection</p>
              <h2 id="about-stats-title" className="about-stats__title">
                A collection that changes with its data.
              </h2>
            </div>
            <p className="about-stats__note">{aboutContent.statsNote}</p>
          </div>
          <dl className="stats-grid">
            {stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section className="about-why section section--ivory">
        <Container>
          <SectionHeading
            eyebrow="Why choose EstateVista"
            title="A more edited way to search."
            description="We combine an editorial eye with clear information, so that every property can be understood on its own terms."
          />
          <div className="about-why__list">
            {aboutContent.whyChoose.map((item) => (
              <article className="about-why__item" key={item.number}>
                <span className="about-why__number">{item.number}</span>
                <h3 className="about-why__item-title">{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="team-section section">
        <Container>
          <SectionHeading
            eyebrow="The people"
            title="Advisors for the decisions that matter."
            description="A specialist team focused on clarity, context and the details that shape a confident move."
          />
          <div className="team-grid">
            {team.map((member) => (
              <TeamCard key={member.id} member={member} />
            ))}
          </div>
        </Container>
      </section>

      <section className="about-cta section section--ivory">
        <Container>
          <div className="about-cta__inner">
            <div>
              <p className="eyebrow">Begin a conversation</p>
              <h2 className="about-cta__title">Tell us what home means to you.</h2>
              <p className="about-cta__copy">
                Our advisors can help you navigate the collection, compare possibilities and move
                forward when the time is right.
              </p>
            </div>
            <div className="about-cta__actions">
              <Link className="button button--primary button--lg" to="/contact">
                Contact EstateVista
              </Link>
              <a className="button button--secondary button--lg" href={contactDetails.phone.href}>
                {contactDetails.phone.label}
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
