import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export default function SmartImage({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  ...rest
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const hasFailed = !src || failedSrc === src;

  if (hasFailed) {
    return (
      <span
        className={`smart-image-fallback${className ? ` ${className}` : ''}`}
        role="img"
        aria-label={alt || 'Image unavailable'}
      >
        <ImageOff size={24} strokeWidth={1.25} aria-hidden="true" />
        <span className="smart-image-fallback__label">Image unavailable</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={() => setFailedSrc(src)}
      {...rest}
    />
  );
}
