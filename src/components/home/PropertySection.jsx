import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import PropertyGrid from '../properties/PropertyGrid';
import EmptyState from '../common/EmptyState';

export default function PropertySection({
  eyebrow,
  title,
  description,
  properties = [],
  ctaTo = '/properties',
  ctaLabel = 'View all properties',
  emptyTitle = 'No available properties yet',
  emptyDescription = 'New properties will appear here as soon as they are added.',
  tone = 'light',
  columns = 3,
}) {
  return (
    <section className={`property-section section section--${tone}`}>
      <Container>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            <Link className="text-link" to={ctaTo}>
              {ctaLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {properties.length > 0 ? (
          <PropertyGrid properties={properties} columns={columns} />
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Link className="button button--secondary button--md" to="/properties">
                Browse all properties
              </Link>
            }
          />
        )}
      </Container>
    </section>
  );
}
