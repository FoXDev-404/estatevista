import { Compass } from 'lucide-react';

export default function ErrorState({
  code,
  title = 'We could not find that page',
  description,
  action,
  titleAs: Heading = 'h2',
  className = '',
}) {
  return (
    <section className={`error-state${className ? ` ${className}` : ''}`}>
      {code ? <p className="error-state__code">{code}</p> : null}
      <span className="error-state__mark" aria-hidden="true">
        <Compass size={28} strokeWidth={1.25} />
      </span>
      <Heading className="error-state__title">{title}</Heading>
      {description ? <p className="error-state__description">{description}</p> : null}
      {action ? <div className="error-state__action">{action}</div> : null}
    </section>
  );
}
