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
import homeContent from '../data/home';

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
        {...homeContent.featured}
        properties={featured}
        ctaTo="/properties?featured=true"
        ctaLabel="View featured collection"
        tone="white"
      />

      <CategorySection />
      <WhyChooseSection />

      <PropertySection
        {...homeContent.trending}
        properties={trending}
        ctaTo="/properties"
        ctaLabel="Explore all properties"
        tone="ivory"
      />

      <LocationSection />
      <ServicesSection limit={3} />

      <PropertySection
        {...homeContent.latest}
        properties={latest}
        ctaTo="/properties?sort=newest"
        ctaLabel="See what is new"
        tone="white"
      />

      <TestimonialSection />
      <CTASection />
    </>
  );
}
