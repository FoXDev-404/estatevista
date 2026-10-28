import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import TestimonialCard from '../common/TestimonialCard';
import testimonials from '../../data/testimonials';
import homeContent from '../../data/home';

export default function TestimonialSection() {
  return (
    <section className="testimonial-section section section--dark">
      <Container>
        <SectionHeading
          {...homeContent.testimonials}
        />
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
        <p className="testimonial-section__note">
          {homeContent.testimonials.note}
        </p>
      </Container>
    </section>
  );
}
