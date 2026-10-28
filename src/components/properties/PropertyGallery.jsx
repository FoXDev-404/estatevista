import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import SmartImage from '../common/SmartImage';
import Modal from '../common/Modal';
import site from '../../data/site';

export default function PropertyGallery({ images = [], title = 'Property' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const safeImages = Array.isArray(images) && images.length > 0 ? images : [site.heroFallbackImage];
  const hasMultiple = safeImages.length > 1;
  const currentImage = safeImages[activeIndex] || safeImages[0];

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + safeImages.length) % safeImages.length);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % safeImages.length);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, safeImages.length]);

  const goPrevious = () =>
    setActiveIndex((index) => (index - 1 + safeImages.length) % safeImages.length);
  const goNext = () => setActiveIndex((index) => (index + 1) % safeImages.length);

  return (
    <div className="property-gallery">
      <div className="property-gallery__main">
        <SmartImage
          src={currentImage}
          alt={`${title} — image ${activeIndex + 1} of ${safeImages.length}`}
          className="property-gallery__main-image"
          loading="eager"
          fetchPriority="high"
          width="1600"
          height="1100"
        />
        <button
          type="button"
          className="property-gallery__expand"
          onClick={() => setLightboxOpen(true)}
          aria-label="Open full-screen image gallery"
        >
          <Expand size={17} aria-hidden="true" />
          View gallery
        </button>

        {hasMultiple ? (
          <div className="property-gallery__arrows">
            <button
              type="button"
              className="property-gallery__arrow"
              onClick={goPrevious}
              aria-label="Previous image"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="property-gallery__arrow"
              onClick={goNext}
              aria-label="Next image"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <span className="property-gallery__counter" aria-hidden="true">
          {String(activeIndex + 1).padStart(2, '0')} / {String(safeImages.length).padStart(2, '0')}
        </span>
      </div>

      {hasMultiple ? (
        <div className="property-gallery__thumbs" role="group" aria-label="Property images">
          {safeImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={`property-gallery__thumb${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`View image ${index + 1} of ${safeImages.length}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <SmartImage
                src={image}
                alt=""
                className="property-gallery__thumb-image"
                loading="lazy"
                width="240"
                height="180"
              />
            </button>
          ))}
        </div>
      ) : null}

      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={`${title} gallery`}
        description={`Image ${activeIndex + 1} of ${safeImages.length}`}
        size="large"
      >
        <div className="lightbox">
          <div className="lightbox__image-wrap">
            <SmartImage
              src={currentImage}
              alt={`${title} — enlarged image ${activeIndex + 1}`}
              className="lightbox__image"
              loading="eager"
              width="1800"
              height="1200"
            />
          </div>
          <div className="lightbox__controls">
            <button
              type="button"
              className="lightbox__arrow"
              onClick={goPrevious}
              disabled={!hasMultiple}
              aria-label="Previous image"
            >
              <ChevronLeft size={20} aria-hidden="true" />
              Previous
            </button>
            <span className="lightbox__counter">
              {activeIndex + 1} / {safeImages.length}
            </span>
            <button
              type="button"
              className="lightbox__arrow"
              onClick={goNext}
              disabled={!hasMultiple}
              aria-label="Next image"
            >
              Next
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
