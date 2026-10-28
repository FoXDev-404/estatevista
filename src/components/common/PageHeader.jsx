import Breadcrumbs from './Breadcrumbs';
import Container from './Container';
import SmartImage from './SmartImage';

export default function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  image,
  imageAlt = '',
  tone = 'ivory',
  aside,
  className = '',
}) {
  return (
    <header
      className={`page-header page-header--${tone}${image ? ' page-header--image' : ''}${className ? ` ${className}` : ''}`}
    >
      {image ? (
        <div className="page-header__media" aria-hidden="true">
          <SmartImage
            src={image}
            alt={imageAlt}
            className="page-header__image"
            loading="eager"
            fetchPriority="high"
            width="2000"
            height="1100"
          />
          <span className="page-header__overlay" />
        </div>
      ) : null}

      <Container className="page-header__inner">
        <Breadcrumbs items={breadcrumbs} className={image ? 'breadcrumbs--light' : ''} />
        <div className="page-header__layout">
          <div className="page-header__content">
            {eyebrow ? <p className={`eyebrow${image ? ' eyebrow--light' : ''}`}>{eyebrow}</p> : null}
            <h1 className="page-header__title">{title}</h1>
            {description ? <p className="page-header__description">{description}</p> : null}
          </div>
          {aside ? <div className="page-header__aside">{aside}</div> : null}
        </div>
      </Container>
    </header>
  );
}
