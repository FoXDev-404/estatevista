import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardCheck,
  Key,
  KeyRound,
  MessagesSquare,
  TrendingUp,
} from 'lucide-react';
import SmartImage from './SmartImage';

const serviceIcons = {
  KeyRound,
  TrendingUp,
  Key,
  MessagesSquare,
  ClipboardCheck,
  BriefcaseBusiness,
};

export default function ServiceCard({ service, index, compact = false }) {
  const Icon = serviceIcons[service.icon] || KeyRound;

  return (
    <article className={`service-card${compact ? ' service-card--compact' : ''}`}>
      <div className="service-card__media">
        <SmartImage
          src={service.image}
          alt={`${service.title} with EstateVista`}
          className="service-card__image"
          width="720"
          height="520"
        />
        <span className="service-card__index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="service-card__body">
        <span className="service-card__icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.4} />
        </span>
        <h3 className="service-card__title">{service.title}</h3>
        <p className="service-card__description">
          {compact ? service.shortDescription : service.description}
        </p>
        <Link className="text-link service-card__link" to={service.ctaTo}>
          {service.ctaLabel}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
