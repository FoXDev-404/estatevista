import { Link } from 'react-router-dom';
import { ArrowUpRight, Bath, BedDouble, MapPin, Maximize2 } from 'lucide-react';
import SmartImage from '../common/SmartImage';
import {
  formatArea,
  formatPropertyPrice,
  formatPropertyPriceCompact,
} from '../../services/formatters';
import {
  propertyTypeLabels,
  purposeLabels,
} from '../../data/propertyOptions';

export default function PropertyCard({ property }) {
  if (!property) return null;

  const specItems = [
    property.specifications?.bedrooms > 0
      ? {
          icon: BedDouble,
          label: `${property.specifications.bedrooms} bd`,
          srLabel: `${property.specifications.bedrooms} bedrooms`,
        }
      : null,
    property.specifications?.bathrooms > 0
      ? {
          icon: Bath,
          label: `${property.specifications.bathrooms} ba`,
          srLabel: `${property.specifications.bathrooms} bathrooms`,
        }
      : null,
    {
      icon: Maximize2,
      label: formatArea(property.specifications?.area, property.specifications?.areaUnit),
      srLabel: `Area ${formatArea(property.specifications?.area, property.specifications?.areaUnit)}`,
    },
  ].filter(Boolean);

  return (
    <article className="property-card">
      <div className="property-card__media">
        <Link
          to={`/properties/${property.slug}`}
          className="property-card__media-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          <SmartImage
            src={property.images?.[0]}
            alt={`${property.title} in ${property.location?.area}, ${property.location?.city}`}
            className="property-card__image"
            loading="lazy"
            width="800"
            height="600"
          />
        </Link>
        <div className="property-card__badges">
          {property.featured ? <span className="badge badge--featured">Featured</span> : null}
          <span className="badge badge--purpose">
            {property.purpose === 'rent' ? 'For rent' : 'For sale'}
          </span>
        </div>
      </div>

      <div className="property-card__body">
        <div className="property-card__meta">
          <span>{propertyTypeLabels[property.type] || property.type}</span>
          <span className="property-card__meta-dot" aria-hidden="true" />
          <span className="property-card__location">
            <MapPin size={13} aria-hidden="true" />
            {property.location?.area}, {property.location?.city}
          </span>
        </div>

        <h3 className="property-card__title">
          <Link to={`/properties/${property.slug}`}>{property.title}</Link>
        </h3>

        <p className="property-card__price">
          <span title={formatPropertyPrice(property)}>
            {formatPropertyPriceCompact(property)}
          </span>
          <span className="sr-only">
            {formatPropertyPrice(property)} · {purposeLabels[property.purpose]}
          </span>
        </p>

        <ul className="property-card__specs" aria-label="Property specifications">
          {specItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.srLabel} aria-label={item.srLabel}>
                <Icon size={15} aria-hidden="true" />
                <span aria-hidden="true">{item.label}</span>
              </li>
            );
          })}
        </ul>

        <Link className="text-link property-card__link" to={`/properties/${property.slug}`}>
          View property
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
