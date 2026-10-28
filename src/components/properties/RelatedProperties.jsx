import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import PropertyGrid from './PropertyGrid';
import useProperties from '../../hooks/useProperties';
import { getRelatedProperties } from '../../services/propertySelectors';

export default function RelatedProperties({ property, limit = 3 }) {
  const { properties } = useProperties();
  const related = getRelatedProperties(properties, property, limit);

  if (!related.length) return null;

  return (
    <section className="related-properties section section--ivory">
      <Container>
        <SectionHeading
          eyebrow="Keep exploring"
          title="More places to consider."
          description="A selection of other available properties that may suit a similar search."
          action={
            <Link className="text-link" to="/properties">
              View all properties
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <PropertyGrid properties={related} columns={3} />
      </Container>
    </section>
  );
}
