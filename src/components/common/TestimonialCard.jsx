import { Quote } from 'lucide-react';

export default function TestimonialCard({ testimonial }) {
  return (
    <figure className="testimonial-card">
      <Quote className="testimonial-card__quote-icon" size={26} aria-hidden="true" />
      <blockquote className="testimonial-card__quote">
        <p>{testimonial.quote}</p>
      </blockquote>
      <figcaption className="testimonial-card__author">
        <span className="testimonial-card__avatar" aria-hidden="true">
          {testimonial.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </span>
        <span>
          <span className="testimonial-card__name">{testimonial.name}</span>
          <span className="testimonial-card__detail">{testimonial.detail}</span>
        </span>
      </figcaption>
    </figure>
  );
}
