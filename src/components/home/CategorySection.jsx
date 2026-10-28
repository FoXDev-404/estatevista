import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import SmartImage from '../common/SmartImage';
import EmptyState from '../common/EmptyState';
import propertyCategories from '../../data/categories';
import useProperties from '../../hooks/useProperties';
import { getAvailableProperties } from '../../services/propertySelectors';
import homeContent from '../../data/home';

export default function CategorySection() {
  const { properties } = useProperties();
  const available = getAvailableProperties(properties);

  const countFor = (category) => {
    if (category.id === 'rental') {
      return available.filter((property) => property.purpose === 'rent').length;
    }
    return available.filter((property) => property.type === category.id).length;
  };

  return (
    <section className="category-section section section--ivory">
      <Container>
        <SectionHeading
          {...homeContent.categories}
          action={
            <Link className="text-link" to="/properties">
              {homeContent.categories.ctaLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          }
        />

        {available.length === 0 ? (
          <EmptyState
            title="The collection is being prepared"
            description="Property categories will reappear when available inventory is added."
            action={
              <Link className="button button--secondary button--md" to="/admin/properties">
                Open property studio
              </Link>
            }
          />
        ) : (
          <div className="category-grid">
            {propertyCategories.map((category, index) => {
              const count = countFor(category);
              return (
                <Link
                  className={`category-card${index === 0 ? ' category-card--featured' : ''}`}
                  to={category.href}
                  key={category.id}
                >
                  <SmartImage
                    src={category.image}
                    alt={`${category.title} with EstateVista`}
                    className="category-card__image"
                    loading="lazy"
                    width="900"
                    height="1100"
                  />
                  <span className="category-card__overlay" aria-hidden="true" />
                  <span className="category-card__content">
                    <span className="category-card__count">
                      {count} {count === 1 ? 'property' : 'properties'}
                    </span>
                    <span className="category-card__title">{category.title}</span>
                    <span className="category-card__description">{category.description}</span>
                    <span className="category-card__link">
                      Explore
                      <ArrowUpRight size={16} aria-hidden="true" />
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
