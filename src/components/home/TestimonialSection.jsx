import Container from '../common/Container';
import SectionHeading from '../common/SectionHeading';
import TestimonialCard from '../common/TestimonialCard';
import testimonials from '../../data/testimonials';

export default function TestimonialSection() {
  return (
    <section className="testimonial-section section section--dark">
      <Container>
        <SectionHeading
          eyebrow="In their words"
          title="The experience matters as much as the address."
          description="Illustrative stories created for this demonstration. They show the tone of a considered property journey rather than verified client endorsements."
        />
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
        <p className="testimonial-section__note">
          All testimonials on this website are sample content. Replace them with verified client
          stories before launch.
        </p>
      </Container>
    </section>
  );
}
