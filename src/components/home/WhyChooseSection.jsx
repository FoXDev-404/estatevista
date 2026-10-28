import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpen,
  HeartHandshake,
  Layers,
} from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import SmartImage from '../common/SmartImage';
import aboutContent from '../../data/about';

const icons = {
  BookOpen,
  Layers,
  BadgeCheck,
  HeartHandshake,
};

export default function WhyChooseSection() {
  return (
    <section className="why-section section section--white">
      <Container>
        <div className="why-section__layout">
          <div className="why-section__visual">
            <SmartImage
              src="/images/about-2.jpg"
              alt="A calm interior with natural light and carefully chosen materials"
              className="why-section__image"
              loading="lazy"
              width="1200"
              height="1500"
            />
            <div className="why-section__caption">
              <p className="why-section__caption-kicker">The EstateVista approach</p>
              <p className="why-section__caption-text">
                Curated, not crowded. Every property earns its place in the collection.
              </p>
              <Link className="text-link text-link--light" to="/about">
                Our story
              </Link>
            </div>
          </div>

          <div className="why-section__content">
            <SectionHeading
              eyebrow="Why choose EstateVista"
              title="A search shaped around you."
              description="We believe the best property decisions begin with clarity — about the place, the process and what you actually want."
            />

            <ol className="why-list">
              {aboutContent.whyChoose.map((item) => {
                const Icon = icons[item.icon] || BookOpen;
                return (
                  <li key={item.number} className="why-list__item">
                    <span className="why-list__number">{item.number}</span>
                    <span className="why-list__icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.4} />
                    </span>
                    <div>
                      <h3 className="why-list__title">{item.title}</h3>
                      <p className="why-list__description">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
