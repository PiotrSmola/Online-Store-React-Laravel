import { useState } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_IMAGE_URL, imageUrl } from '../../lib/product';

function sourcesFor(image, thumbnail) {
  const sources = [imageUrl(image, { thumbnail }), imageUrl(image), DEFAULT_IMAGE_URL];
  return [...new Set(sources)];
}

/**
 * A 3:4 product photo. A missing thumbnail falls back to the original, and a missing original to
 * the default photo. Give it a key when the same element can show another photo.
 *
 * @param {'lazy' | 'eager' | 'high'} priority eager for the first row, high for the likely LCP image.
 */
export default function ProductImage({ image = null, alt, thumbnail = false, priority = 'lazy', className = '' }) {
  const [failures, setFailures] = useState(0);
  const sources = sourcesFor(image, thumbnail);

  return (
    <img
      src={sources[Math.min(failures, sources.length - 1)]}
      alt={alt}
      width="600"
      height="800"
      decoding="async"
      loading={priority === 'lazy' ? 'lazy' : 'eager'}
      fetchPriority={priority === 'high' ? 'high' : undefined}
      className={`aspect-[3/4] w-full bg-mist object-cover ${className}`}
      onError={() => setFailures((count) => (count < sources.length - 1 ? count + 1 : count))}
    />
  );
}

ProductImage.propTypes = {
  image: PropTypes.shape({ image_path: PropTypes.string }),
  alt: PropTypes.string.isRequired,
  thumbnail: PropTypes.bool,
  priority: PropTypes.oneOf(['lazy', 'eager', 'high']),
  className: PropTypes.string,
};
