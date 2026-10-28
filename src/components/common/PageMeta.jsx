import { useEffect } from 'react';
import site from '../../data/site';

const setMeta = (selector, attribute, value) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    const match = /^meta\[(name|property)="(.+)"\]$/.exec(selector);
    if (match) element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
};

export default function PageMeta({
  title,
  description = site.description,
  image = '/images/hero-1.jpg',
  noIndex = false,
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${site.name}` : `${site.name} — ${site.tagline}`;
    document.title = fullTitle;

    const absoluteImage =
      typeof window !== 'undefined' && image.startsWith('/')
        ? `${window.location.origin}${image}`
        : image;

    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:image"]', 'content', absoluteImage);
    setMeta('meta[name="twitter:title"]', 'content', fullTitle);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', absoluteImage);
    setMeta(
      'meta[name="robots"]',
      'content',
      noIndex ? 'noindex, nofollow' : 'index, follow',
    );
  }, [title, description, image, noIndex]);

  return null;
}
