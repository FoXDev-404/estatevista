import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import SmartImage from '../common/SmartImage';
import Container from '../common/Container';
import heroSlides from '../../data/hero-slides';
import site from '../../data/site';
import useReducedMotion from '../../hooks/useReducedMotion';

function HeroMedia({ slide }) {
  const [videoFailed, setVideoFailed] = useState(false);

  if (slide.mediaType === 'video' && !videoFailed) {
    return (
      <video
        className="hero__video"
        autoPlay
        muted
        loop
        playsInline
        poster={slide.poster}
        aria-hidden="true"
        onError={() => setVideoFailed(true)}
      >
        <source src={slide.mediaSrc} type="video/mp4" />
      </video>
    );
  }

  return (
    <SmartImage
      src={slide.poster || slide.mediaSrc}
      alt={slide.alt || ''}
      className="hero__image"
      loading="eager"
      fetchPriority="high"
      width="2200"
      height="1467"
    />
  );
}

export default function HeroSlider() {
  const slides = useMemo(
    () => heroSlides.filter((slide) => slide.isActive !== false),
    [],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const prefersReducedMotion = useReducedMotion();

  const slideCount = slides.length;
  const currentSlide = slides[activeIndex] || slides[0] || null;

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentHidden(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const isPaused =
    isHovered ||
    hasFocus ||
    isDocumentHidden ||
    prefersReducedMotion ||
    isUserPaused ||
    slideCount < 2;

  useEffect(() => {
    if (isPaused || !currentSlide) return undefined;
    const duration = Number(currentSlide.duration) || 7000;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [activeIndex, currentSlide, isPaused, slideCount]);

  const goTo = useCallback(
    (index) => {
      if (slideCount === 0) return;
      setActiveIndex(((index % slideCount) + slideCount) % slideCount);
    },
    [slideCount],
  );

  const goPrevious = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  if (!currentSlide) {
    return (
      <section className="hero hero--fallback" aria-labelledby="hero-fallback-title">
        <div className="hero__media">
          <SmartImage
            src={site.heroFallbackImage}
            alt=""
            className="hero__image"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <Container className="hero__inner">
          <p className="hero__eyebrow">EstateVista</p>
          <h1 id="hero-fallback-title" className="hero__title">
            {site.tagline}
          </h1>
          <p className="hero__subtitle">{site.description}</p>
          <Link className="button button--gold button--lg" to="/properties">
            Explore properties
          </Link>
        </Container>
      </section>
    );
  }

  const duration = Number(currentSlide.duration) || 7000;

  return (
    <section
      className={`hero${isPaused ? ' is-paused' : ''}`}
      aria-roledescription="carousel"
      aria-label="Featured properties and places"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      <div className="hero__media">
        <HeroMedia key={currentSlide.id} slide={currentSlide} />
        <span className="hero__overlay" aria-hidden="true" />
        <span className="hero__grain" aria-hidden="true" />
      </div>

      <Container className="hero__inner">
        <div className="hero__slide" key={currentSlide.id} aria-roledescription="slide">
          <p className="hero__eyebrow">
            <span className="hero__eyebrow-line" aria-hidden="true" />
            {currentSlide.eyebrow}
          </p>
          <h1 className="hero__title">{currentSlide.heading}</h1>
          <p className="hero__subtitle">{currentSlide.subtitle}</p>
          <div className="hero__actions">
            <Link className="button button--gold button--lg" to={currentSlide.ctaTo}>
              {currentSlide.ctaLabel}
            </Link>
            <span className="hero__slide-count" aria-label={`Slide ${activeIndex + 1} of ${slideCount}`}>
              <span>{String(activeIndex + 1).padStart(2, '0')}</span>
              <span className="hero__slide-count-divider" aria-hidden="true" />
              {String(slideCount).padStart(2, '0')}
            </span>
          </div>
        </div>
      </Container>

      <Container className="hero__controls-wrap">
        <div className="hero__controls">
          <div className="hero__dots" role="group" aria-label="Choose a slide">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`hero__dot${index === activeIndex ? ' is-active' : ''}`}
                aria-label={`Show slide ${index + 1}: ${slide.heading}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>

          <div className="hero__arrow-group">
            <button
              type="button"
              className="hero__arrow"
              onClick={goPrevious}
              aria-label="Previous slide"
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero__arrow"
              onClick={goNext}
              aria-label="Next slide"
            >
              <ChevronRight size={19} aria-hidden="true" />
            </button>
            {!prefersReducedMotion && slideCount > 1 ? (
              <button
                type="button"
                className="hero__arrow hero__play-toggle"
                onClick={() => setIsUserPaused((paused) => !paused)}
                aria-label={isUserPaused ? 'Play slideshow' : 'Pause slideshow'}
                title={isUserPaused ? 'Play slideshow' : 'Pause slideshow'}
              >
                {isUserPaused ? (
                  <Play size={17} aria-hidden="true" />
                ) : (
                  <Pause size={17} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        </div>

        <span
          className="hero__progress"
          key={`${currentSlide.id}-${isPaused ? 'paused' : 'playing'}`}
          style={{ '--slide-duration': `${duration}ms` }}
          aria-hidden="true"
        />
      </Container>
    </section>
  );
}
