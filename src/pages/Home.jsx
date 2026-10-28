import { useMemo } from 'react';
import Container from '../components/common/Container';
import PageMeta from '../components/common/PageMeta';
import HeroSlider from '../components/home/HeroSlider';
import PropertySearch from '../components/home/PropertySearch';
import PropertySection from '../components/home/PropertySection';
import CategorySection from '../components/home/CategorySection';
import WhyChooseSection from '../components/home/WhyChooseSection';
import LocationSection from '../components/home/LocationSection';
import ServicesSection from '../components/home/ServicesSection';
import TestimonialSection from '../components/home/TestimonialSection';
import CTASection from '../components/home/CTASection';
import useProperties from '../hooks/useProperties';
import {
  getFeaturedProperties,
  getLatestProperties,
  getTrendingProperties,
} from '../services/propertySelectors';

export default function Home() {
  const { properties } = useProperties();

  const featured = useMemo(() => getFeaturedProperties(properties, 3), [properties]);
  const trending = useMemo(() => getTrendingProperties(properties, 3), [properties]);
  const latest = useMemo(() => getLatestProperties(properties, 3), [properties]);

  return (
    <>
      <PageMeta />
      <HeroSlider />

      <section className="home-search" aria-label="Property search">
        <Container>
          <PropertySearch />
        </Container>
      </section>

      <PropertySection
        eyebrow="The signature collection"
        title="A considered place to begin."
        description="A small selection of featured homes from the current EstateVista collection, chosen for their sense of space, setting and design."
        properties={featured}
        ctaTo="/properties?featured=true"
        ctaLabel="View featured collection"
        emptyTitle="No featured properties right now"
        emptyDescription="Explore the full collection, or mark a property as featured in the property studio."
        tone="white"
      />

      <CategorySection />
      <WhyChooseSection />

      <PropertySection
        eyebrow="Currently captivating"
        title="Properties with a certain pull."
        description="Homes that have caught the attention of our editors and visitors — distinctive places with a clear point of view."
        properties={trending}
        ctaTo="/properties"
        ctaLabel="Explore all properties"
        emptyTitle="Trending properties will appear here"
        emptyDescription="Properties marked as trending will appear in this section when available."
        tone="ivory"
      />

      <LocationSection />
      <ServicesSection limit={3} />

      <PropertySection
        eyebrow="New to EstateVista"
        title="The latest arrivals."
        description="Recently added properties, ordered by the date they joined the collection."
        properties={latest}
        ctaTo="/properties?sort=newest"
        ctaLabel="See what is new"
        emptyTitle="No new properties yet"
        emptyDescription="New records will appear here as soon as they are added."
        tone="white"
      />

      <TestimonialSection />
      <CTASection />
    </>
  );
}
