import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import SmartImage from '../common/SmartImage';
import EmptyState from '../common/EmptyState';
import locations from '../../data/locations';
import useProperties from '../../hooks/useProperties';
import { getAvailableProperties } from '../../services/propertySelectors';
import { buildListingSearchParams } from '../../services/searchParams';
import homeContent from '../../data/home';

export default function LocationSection() {
  const { properties } = useProperties();
  const available = getAvailableProperties(properties);
  const locationsWithProperties = locations
    .map((location) => ({
      ...location,
      count: available.filter((property) => property.location?.city === location.city).length,
    }))
    .filter((location) => location.count > 0);

  return (
    <section className="location-section section section--white">
      <Container>
        <SectionHeading
          {...homeContent.locations}
          action={
            <Link className="text-link" to="/properties">
              {homeContent.locations.ctaLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        />

        {locationsWithProperties.length === 0 ? (
          <EmptyState
            title="Locations will appear with available inventory"
            description="Add an available property in the property studio to bring a destination to life."
          />
        ) : (
          <div className="location-grid">
            {locationsWithProperties.map((location, index) => {
              const params = buildListingSearchParams({ location: location.city });
              return (
                <Link
                  key={location.city}
                  className={`location-card${index === 0 ? ' location-card--large' : ''}`}
                  to={`/properties?${params.toString()}`}
                >
                  <SmartImage
                    src={location.image}
                    alt={`Properties in ${location.city}`}
                    className="location-card__image"
                    loading="lazy"
                    width="1000"
                    height="700"
                  />
                  <span className="location-card__overlay" aria-hidden="true" />
                  <span className="location-card__content">
                    <span className="location-card__count">
                      {location.count} {location.count === 1 ? 'property' : 'properties'}
                    </span>
                    <span className="location-card__city">{location.city}</span>
                    <span className="location-card__note">{location.note}</span>
                    <span className="location-card__link">
                      View {location.city}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
